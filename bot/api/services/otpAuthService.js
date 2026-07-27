const crypto = require("crypto");
const pool = require("../../config/database");
const { deliverOtp } = require("../../services/whatsappService");

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_LENGTH = 6;
const MAX_VERIFY_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_MS = Number(process.env.OTP_RESEND_COOLDOWN_SECONDS || 60) * 1000;
const OTP_RATE_LIMIT_WINDOW_MS = Number(process.env.OTP_RATE_LIMIT_WINDOW_SECONDS || 15 * 60) * 1000;
const OTP_MAX_REQUESTS_PER_WINDOW = Number(process.env.OTP_MAX_REQUESTS_PER_WINDOW || 5);

class OtpRateLimitError extends Error {
  constructor(message, retryAfterSeconds) {
    super(message);
    this.name = "OtpRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

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
  return String(crypto.randomInt(10 ** (OTP_LENGTH - 1), 10 ** OTP_LENGTH));
}

async function reserveOtpRequest(phoneNumber, ipAddress) {
  const client = await pool.connect();
  const now = new Date();
  const windowStart = new Date(now.getTime() - OTP_RATE_LIMIT_WINDOW_MS);
  let transactionOpen = false;

  try {
    await client.query("BEGIN");
    transactionOpen = true;
    await client.query("INSERT INTO users (phone_number) VALUES ($1) ON CONFLICT (phone_number) DO NOTHING", [phoneNumber]);
    await client.query("SELECT id FROM users WHERE phone_number = $1 FOR UPDATE", [phoneNumber]);
    await client.query("DELETE FROM otp_request_attempts WHERE created_at < $1", [windowStart]);

    const latestRequest = await client.query(
      "SELECT created_at FROM otp_request_attempts WHERE phone_number = $1 ORDER BY created_at DESC LIMIT 1 FOR UPDATE",
      [phoneNumber]
    );
    const lastRequestedAt = latestRequest.rows[0]?.created_at;
    if (lastRequestedAt && now.getTime() - new Date(lastRequestedAt).getTime() < OTP_RESEND_COOLDOWN_MS) {
      const retryAfterSeconds = Math.ceil((OTP_RESEND_COOLDOWN_MS - (now.getTime() - new Date(lastRequestedAt).getTime())) / 1000);
      await client.query("COMMIT");
      transactionOpen = false;
      throw new OtpRateLimitError("Please wait before requesting another OTP", retryAfterSeconds);
    }

    const limits = await client.query(
      `SELECT COUNT(*) FILTER (WHERE phone_number = $1) AS phone_count,
              COUNT(*) FILTER (WHERE ip_address = $2) AS ip_count
       FROM otp_request_attempts WHERE created_at >= $3`,
      [phoneNumber, ipAddress || null, windowStart]
    );
    const { phone_count: phoneCount, ip_count: ipCount } = limits.rows[0];
    if (Number(phoneCount) >= OTP_MAX_REQUESTS_PER_WINDOW || (ipAddress && Number(ipCount) >= OTP_MAX_REQUESTS_PER_WINDOW)) {
      await client.query("COMMIT");
      transactionOpen = false;
      throw new OtpRateLimitError("Too many OTP requests. Please try again later", Math.ceil(OTP_RATE_LIMIT_WINDOW_MS / 1000));
    }

    await client.query("INSERT INTO otp_request_attempts (phone_number, ip_address) VALUES ($1, $2)", [phoneNumber, ipAddress || null]);
    await client.query("COMMIT");
    transactionOpen = false;
  } catch (error) {
    if (transactionOpen) await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function requestOtp(phoneNumber, ipAddress) {
  const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
  const code = createOtp();
  await reserveOtpRequest(normalizedPhoneNumber, ipAddress);
  await deliverOtp(normalizedPhoneNumber, code, OTP_TTL_MS / 60_000);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("INSERT INTO users (phone_number) VALUES ($1) ON CONFLICT (phone_number) DO NOTHING", [normalizedPhoneNumber]);
    await client.query("DELETE FROM otp_challenges WHERE phone_number = $1", [normalizedPhoneNumber]);
    await client.query("INSERT INTO otp_challenges (phone_number, code_hash, expires_at, attempts) VALUES ($1, $2, $3, 0)", [normalizedPhoneNumber, hashOtp(code), new Date(Date.now() + OTP_TTL_MS)]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return { phoneNumber: normalizedPhoneNumber };
}

async function verifyOtp(phoneNumber, code) {
  const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
  const client = await pool.connect();
  let transactionOpen = false;
  try {
    await client.query("BEGIN");
    transactionOpen = true;
    const result = await client.query("SELECT code_hash, expires_at, attempts FROM otp_challenges WHERE phone_number = $1 FOR UPDATE", [normalizedPhoneNumber]);
    const challenge = result.rows[0];
    if (!challenge || new Date(challenge.expires_at) <= new Date() || challenge.attempts >= MAX_VERIFY_ATTEMPTS) {
      if (challenge) await client.query("DELETE FROM otp_challenges WHERE phone_number = $1", [normalizedPhoneNumber]);
      await client.query("COMMIT");
      transactionOpen = false;
      throw new Error("Invalid or expired OTP");
    }

    const submittedHash = hashOtp(String(code || ""));
    const isMatch = crypto.timingSafeEqual(Buffer.from(challenge.code_hash, "hex"), Buffer.from(submittedHash, "hex"));
    if (!isMatch) {
      await client.query("UPDATE otp_challenges SET attempts = attempts + 1 WHERE phone_number = $1", [normalizedPhoneNumber]);
      await client.query("COMMIT");
      transactionOpen = false;
      throw new Error("Invalid or expired OTP");
    }

    await client.query("DELETE FROM otp_challenges WHERE phone_number = $1", [normalizedPhoneNumber]);
    await client.query("UPDATE users SET last_authenticated_at = NOW() WHERE phone_number = $1", [normalizedPhoneNumber]);
    await client.query("COMMIT");
    transactionOpen = false;
    return { phoneNumber: normalizedPhoneNumber };
  } catch (error) {
    if (transactionOpen) await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function createSessionToken(phoneNumber) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET must be configured");
  const payload = Buffer.from(JSON.stringify({ sub: phoneNumber, exp: Date.now() + 24 * 60 * 60 * 1000 })).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

module.exports = { OTP_TTL_MS, OtpRateLimitError, requestOtp, verifyOtp, createSessionToken };
