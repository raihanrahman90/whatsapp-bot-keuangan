import express = require("express");
import {
  OTP_TTL_MS,
  OtpRateLimitError,
  requestOtp,
  verifyOtp,
  createSessionToken
} from "../services/otpAuthService";
import { getErrorMessage } from "../types";

const router = express.Router();
const useSecureCookies = process.env.SESSION_COOKIE_SECURE === "true" ||
  (process.env.SESSION_COOKIE_SECURE === undefined && process.env.NODE_ENV === "production");

router.post("/request-otp", async (req, res) => {
  try {
    const { phoneNumber } = (req.body || {}) as { phoneNumber?: unknown };
    const result = await requestOtp(phoneNumber, req.ip);
    return res.status(202).json({ message: "OTP sent to WhatsApp", phoneNumber: result.phoneNumber, expiresInSeconds: OTP_TTL_MS / 1000 });
  } catch (error) {
    const message = getErrorMessage(error, "Unable to request OTP");
    const status = message.includes("phoneNumber") ? 400 : error instanceof OtpRateLimitError ? 429 : 503;
    console.error("POST /api/auth/request-otp error:", message);
    if (error instanceof OtpRateLimitError) res.set("Retry-After", String(error.retryAfterSeconds));
    return res.status(status).json({ error: message, ...(error instanceof OtpRateLimitError ? { retryAfterSeconds: error.retryAfterSeconds } : {}) });
  }
});

router.post("/verify-otp", async (req, res) => {
  try {
    const { phoneNumber, code } = (req.body || {}) as { phoneNumber?: unknown; code?: unknown };
    const result = await verifyOtp(phoneNumber, code);
    res.cookie("session", createSessionToken(result.phoneNumber), { httpOnly: true, sameSite: "lax", secure: useSecureCookies, maxAge: 24 * 60 * 60 * 1000, path: "/" });
    return res.status(200).json({ message: "OTP verified", user: { phoneNumber: result.phoneNumber } });
  } catch (error) {
    const message = getErrorMessage(error, "Unable to verify OTP");
    const status = message.includes("phoneNumber") ? 400 : message === "Invalid or expired OTP" ? 401 : 500;
    console.error("POST /api/auth/verify-otp error:", message);
    return res.status(status).json({ error: status === 500 ? "Unable to verify OTP" : message });
  }
});

router.post("/logout", (_req, res) => {
  res.clearCookie("session", { httpOnly: true, sameSite: "lax", secure: useSecureCookies, path: "/" });
  return res.status(204).end();
});

export = router;
