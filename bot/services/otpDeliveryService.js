const OTP_PATTERN = /^\d{6}$/;

function normalizeWhatsAppNumber(phoneNumber) {
  const normalized = String(phoneNumber || "").replace(/[^\d]/g, "");

  if (!/^\d{8,15}$/.test(normalized)) {
    throw new Error("phoneNumber must be an E.164 number without the leading +");
  }

  return normalized;
}

async function sendOtp(sock, phoneNumber, code, expiresInMinutes = 5) {
  if (!sock) {
    throw new Error("WhatsApp socket is not ready");
  }

  const recipient = `${normalizeWhatsAppNumber(phoneNumber)}@s.whatsapp.net`;
  const otp = String(code || "");

  if (!OTP_PATTERN.test(otp)) {
    throw new Error("code must be a 6-digit OTP");
  }

  await sock.sendMessage(recipient, {
    text: [
      "Kode verifikasi WhatsApp Bot Keuangan",
      "",
      `Kode OTP Anda: ${otp}`,
      `Berlaku selama ${expiresInMinutes} menit.`,
      "",
      "Jangan bagikan kode ini kepada siapa pun."
    ].join("\n")
  });
}

module.exports = {
  sendOtp
};
