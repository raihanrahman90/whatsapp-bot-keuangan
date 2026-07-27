const express = require("express");
const {
  OTP_TTL_MS,
  requestOtp,
  verifyOtp,
  createSessionToken
} = require("../services/otpAuthService");

const router = express.Router();

router.post("/request-otp", async (req, res) => {
  try {
    const { phoneNumber } = req.body || {};
    const result = await requestOtp(phoneNumber);

    return res.status(202).json({
      message: "OTP sent to WhatsApp",
      phoneNumber: result.phoneNumber,
      expiresInSeconds: OTP_TTL_MS / 1000
    });
  } catch (error) {
    const status = error.message.includes("phoneNumber") ? 400 : 503;
    console.error("POST /api/auth/request-otp error:", error.message);
    return res.status(status).json({ error: error.message });
  }
});

router.post("/verify-otp", async (req, res) => {
  try {
    const { phoneNumber, code } = req.body || {};
    const { phoneNumber: verifiedPhoneNumber } = await verifyOtp(phoneNumber, code);
    const token = createSessionToken(verifiedPhoneNumber);

    res.cookie("session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000,
      path: "/"
    });

    return res.status(200).json({
      message: "OTP verified",
      user: { phoneNumber: verifiedPhoneNumber }
    });
  } catch (error) {
    const status = error.message.includes("phoneNumber")
      ? 400
      : error.message === "Invalid or expired OTP"
        ? 401
        : 500;
    console.error("POST /api/auth/verify-otp error:", error.message);
    return res.status(status).json({
      error: status === 500 ? "Unable to verify OTP" : error.message
    });
  }
});

module.exports = router;
