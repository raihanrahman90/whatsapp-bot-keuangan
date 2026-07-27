const express = require("express");
const { OTP_TTL_MS, OtpRateLimitError, requestOtp, verifyOtp, createSessionToken } = require("../services/otpAuthService");

const router = express.Router();
const useSecureCookies = process.env.SESSION_COOKIE_SECURE === "true" || (process.env.SESSION_COOKIE_SECURE === undefined && process.env.NODE_ENV === "production");

router.post("/request-otp", async (req, res) => {
  try {
    const result = await requestOtp(req.body?.phoneNumber, req.ip);
    return res.status(202).json({ message: "OTP sent to WhatsApp", phoneNumber: result.phoneNumber, expiresInSeconds: OTP_TTL_MS / 1000 });
  } catch (error) {
    const status = error.message.includes("phoneNumber") ? 400 : error instanceof OtpRateLimitError ? 429 : 503;
    console.error("POST /api/auth/request-otp error:", error.message);
    if (error instanceof OtpRateLimitError) res.set("Retry-After", String(error.retryAfterSeconds));
    return res.status(status).json({ error: error.message, ...(error instanceof OtpRateLimitError ? { retryAfterSeconds: error.retryAfterSeconds } : {}) });
  }
});

router.post("/verify-otp", async (req, res) => {
  try {
    const { phoneNumber } = await verifyOtp(req.body?.phoneNumber, req.body?.code);
    res.cookie("session", createSessionToken(phoneNumber), { httpOnly: true, sameSite: "lax", secure: useSecureCookies, maxAge: 24 * 60 * 60 * 1000, path: "/" });
    return res.status(200).json({ message: "OTP verified", user: { phoneNumber } });
  } catch (error) {
    const status = error.message.includes("phoneNumber") ? 400 : error.message === "Invalid or expired OTP" ? 401 : 500;
    console.error("POST /api/auth/verify-otp error:", error.message);
    return res.status(status).json({ error: status === 500 ? "Unable to verify OTP" : error.message });
  }
});

router.post("/logout", (_req, res) => {
  res.clearCookie("session", { httpOnly: true, sameSite: "lax", secure: useSecureCookies, path: "/" });
  return res.status(204).end();
});

module.exports = router;
