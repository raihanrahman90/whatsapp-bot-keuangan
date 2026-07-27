const crypto = require("crypto");
const pool = require("../config/db");

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_LENGTH = 6;
const MAX_VERIFY_ATTEMPTS = 5;

function normalizePhoneNumber(phoneNumber) {
  const normalized = String(phoneNumber || "").replace(/[^\d]/g, "");

  if (!/^\d{8,15}$/.test(normalized)) {
    throw new Error("phoneNumber must be an E.164 number without the leading +");
  }

  return normalized;
}

function hashOtp(code) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function createOtp() {
  const minimum = 10 ** (OTP_LENGTH - 1);
  return String(crypto.randomInt(minimum, 10 ** OTP_LENGTH));
}

async function deliverOtp(phoneNumber, code) {
  const bridgeUrl = process.env.OTP_BRIDGE_URL || "http://whatsapp-bot:3000";
  const bridgeSecret = process.env.OTP_BRIDGE_SECRET;

  if (!bridgeSecret) {
    throw new Error("OTP_BRIDGE_SECRET must be configured");
  }

  const response = await fetch(`${bridgeUrl}/internal/otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bridgeSecret}`
    },
    body: JSON.stringify({
      phoneNumber,
      code,
      expiresInMinutes: OTP_TTL_MS / 60_000
    })
  });

  if (!response.ok) {
    let message = "OTP delivery failed";
    try {
      message = (await response.json()).error || message;
    } catch {
      // The bridge may have returned a non-JSON proxy error.
    }
    throw new Error(message);
  }
}

async function requestOtp(phoneNumber) {
  const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
  const code = createOtp();

  await deliverOtp(normalizedPhoneNumber, code);

  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO users (phone_number)
       VALUES ($1)
       ON CONFLICT (phone_number) DO NOTHING`,
      [normalizedPhoneNumber]
    );
    await client.query("DELETE FROM otp_challenges WHERE phone_number = $1", [
      normalizedPhoneNumber
    ]);
    await client.query(
      `INSERT INTO otp_challenges (phone_number, code_hash, expires_at, attempts)
       VALUES ($1, $2, $3, 0)`,
      [normalizedPhoneNumber, hashOtp(code), expiresAt]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return { phoneNumber: normalizedPhoneNumber, expiresAt };
}

async function verifyOtp(phoneNumber, code) {
  const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
  const submittedCode = String(code || "");
  const client = await pool.connect();
  let transactionOpen = false;

  try {
    await client.query("BEGIN");
    transactionOpen = true;
    const result = await client.query(
      `SELECT code_hash, expires_at, attempts
       FROM otp_challenges
       WHERE phone_number = $1
       FOR UPDATE`,
      [normalizedPhoneNumber]
    );
    const challenge = result.rows[0];

    if (
      !challenge ||
      new Date(challenge.expires_at) <= new Date() ||
      challenge.attempts >= MAX_VERIFY_ATTEMPTS
    ) {
      if (challenge) {
        await client.query("DELETE FROM otp_challenges WHERE phone_number = $1", [
          normalizedPhoneNumber
        ]);
      }
      await client.query("COMMIT");
      transactionOpen = false;
      throw new Error("Invalid or expired OTP");
    }

    const submittedHash = hashOtp(submittedCode);
    const isMatch = crypto.timingSafeEqual(
      Buffer.from(challenge.code_hash, "hex"),
      Buffer.from(submittedHash, "hex")
    );

    if (!isMatch) {
      await client.query(
        "UPDATE otp_challenges SET attempts = attempts + 1 WHERE phone_number = $1",
        [normalizedPhoneNumber]
      );
      await client.query("COMMIT");
      transactionOpen = false;
      throw new Error("Invalid or expired OTP");
    }

    await client.query("DELETE FROM otp_challenges WHERE phone_number = $1", [
      normalizedPhoneNumber
    ]);
    await client.query(
      "UPDATE users SET last_authenticated_at = NOW() WHERE phone_number = $1",
      [normalizedPhoneNumber]
    );
    await client.query("COMMIT");
    transactionOpen = false;
    return { phoneNumber: normalizedPhoneNumber };
  } catch (error) {
    if (transactionOpen) {
      await client.query("ROLLBACK");
    }
    throw error;
  } finally {
    client.release();
  }
}

function createSessionToken(phoneNumber) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET must be configured");
  }

  const payload = Buffer.from(
    JSON.stringify({ sub: phoneNumber, exp: Date.now() + 24 * 60 * 60 * 1000 })
  ).toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");

  return `${payload}.${signature}`;
}

module.exports = {
  OTP_TTL_MS,
  requestOtp,
  verifyOtp,
  createSessionToken
};
