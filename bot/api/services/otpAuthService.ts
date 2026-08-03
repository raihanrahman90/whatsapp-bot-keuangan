import crypto = require("node:crypto");
import prisma = require("../../config/prisma");
import { deliverOtp } from "../../services/whatsappService";

export const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_LENGTH = 6;
const MAX_VERIFY_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_MS = Number(process.env.OTP_RESEND_COOLDOWN_SECONDS || 60) * 1000;
const OTP_RATE_LIMIT_WINDOW_MS = Number(process.env.OTP_RATE_LIMIT_WINDOW_SECONDS || 15 * 60) * 1000;
const OTP_MAX_REQUESTS_PER_WINDOW = Number(process.env.OTP_MAX_REQUESTS_PER_WINDOW || 5);

export class OtpRateLimitError extends Error {
  retryAfterSeconds: number;

  constructor(message: string, retryAfterSeconds: number) {
    super(message);
    this.name = "OtpRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function normalizePhoneNumber(phoneNumber: unknown): string {
  const normalized = String(phoneNumber || "").replace(/[^\d]/g, "");
  if (!/^\d{8,15}$/.test(normalized)) {
    throw new Error("phoneNumber must be an E.164 number without the leading +");
  }
  return normalized;
}

function hashOtp(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function createOtp(): string {
  return String(crypto.randomInt(10 ** (OTP_LENGTH - 1), 10 ** OTP_LENGTH));
}

async function reserveOtpRequest(phoneNumber: string, ipAddress?: string): Promise<void> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - OTP_RATE_LIMIT_WINDOW_MS);
  const rateLimit = await prisma.$transaction(async (tx) => {
    await tx.user.upsert({ where: { phoneNumber }, update: {}, create: { phoneNumber } });
    await tx.otpRequestAttempt.deleteMany({ where: { createdAt: { lt: windowStart } } });

    const latestRequest = await tx.otpRequestAttempt.findFirst({
      where: { phoneNumber },
      orderBy: { createdAt: "desc" }
    });
    if (latestRequest && now.getTime() - latestRequest.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
      return {
        message: "Please wait before requesting another OTP",
        retryAfterSeconds: Math.ceil((OTP_RESEND_COOLDOWN_MS - (now.getTime() - latestRequest.createdAt.getTime())) / 1000)
      };
    }

    const [phoneCount, ipCount] = await Promise.all([
      tx.otpRequestAttempt.count({ where: { phoneNumber, createdAt: { gte: windowStart } } }),
      ipAddress ? tx.otpRequestAttempt.count({ where: { ipAddress, createdAt: { gte: windowStart } } }) : Promise.resolve(0)
    ]);
    if (phoneCount >= OTP_MAX_REQUESTS_PER_WINDOW || (ipAddress && ipCount >= OTP_MAX_REQUESTS_PER_WINDOW)) {
      return {
        message: "Too many OTP requests. Please try again later",
        retryAfterSeconds: Math.ceil(OTP_RATE_LIMIT_WINDOW_MS / 1000)
      };
    }

    await tx.otpRequestAttempt.create({ data: { phoneNumber, ipAddress: ipAddress || null } });
    return null;
  }, { isolationLevel: "Serializable" });

  if (rateLimit) throw new OtpRateLimitError(rateLimit.message, rateLimit.retryAfterSeconds);
}

export async function requestOtp(phoneNumber: unknown, ipAddress?: string): Promise<{ phoneNumber: string }> {
  const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
  const code = createOtp();
  await reserveOtpRequest(normalizedPhoneNumber, ipAddress);
  await deliverOtp(normalizedPhoneNumber, code, OTP_TTL_MS / 60_000);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.upsert({
      where: { phoneNumber: normalizedPhoneNumber },
      update: {},
      create: { phoneNumber: normalizedPhoneNumber }
    });
    await tx.whatsAppIdentity.upsert({
      where: { whatsappId: normalizedPhoneNumber },
      update: { lastSeenAt: new Date() },
      create: { userId: user.id, whatsappId: normalizedPhoneNumber }
    });
    await tx.otpChallenge.deleteMany({ where: { phoneNumber: normalizedPhoneNumber } });
    await tx.otpChallenge.create({
      data: {
        phoneNumber: normalizedPhoneNumber,
        codeHash: hashOtp(code),
        expiresAt: new Date(Date.now() + OTP_TTL_MS)
      }
    });
  }, { isolationLevel: "Serializable" });

  return { phoneNumber: normalizedPhoneNumber };
}

export async function verifyOtp(phoneNumber: unknown, code: unknown): Promise<{ phoneNumber: string }> {
  const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
  const result = await prisma.$transaction(async (tx) => {
    const challenge = await tx.otpChallenge.findUnique({ where: { phoneNumber: normalizedPhoneNumber } });
    if (!challenge || challenge.expiresAt <= new Date() || challenge.attempts >= MAX_VERIFY_ATTEMPTS) {
      if (challenge) await tx.otpChallenge.delete({ where: { phoneNumber: normalizedPhoneNumber } });
      return null;
    }

    const submittedHash = hashOtp(String(code || ""));
    const isMatch = crypto.timingSafeEqual(Buffer.from(challenge.codeHash, "hex"), Buffer.from(submittedHash, "hex"));
    if (!isMatch) {
      await tx.otpChallenge.update({ where: { phoneNumber: normalizedPhoneNumber }, data: { attempts: { increment: 1 } } });
      return null;
    }

    await tx.otpChallenge.delete({ where: { phoneNumber: normalizedPhoneNumber } });
    await tx.user.update({ where: { phoneNumber: normalizedPhoneNumber }, data: { lastAuthenticatedAt: new Date() } });
    return { phoneNumber: normalizedPhoneNumber };
  }, { isolationLevel: "Serializable" });

  if (!result) throw new Error("Invalid or expired OTP");
  return result;
}

export function createSessionToken(phoneNumber: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET must be configured");
  const payload = Buffer.from(JSON.stringify({ sub: phoneNumber, exp: Date.now() + 24 * 60 * 60 * 1000 })).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}
