import type { WASocket } from "@whiskeysockets/baileys" with { "resolution-mode": "import" };

const OTP_PATTERN = /^\d{6}$/;

function normalizeWhatsAppNumber(phoneNumber: unknown): string {
  const normalized = String(phoneNumber || "").replace(/[^\d]/g, "");
  if (!/^\d{8,15}$/.test(normalized)) {
    throw new Error("phoneNumber must be an E.164 number without the leading +");
  }
  return normalized;
}

export async function sendOtp(sock: WASocket | null, phoneNumber: unknown, code: unknown, expiresInMinutes = 5): Promise<void> {
  if (!sock) throw new Error("WhatsApp socket is not ready");

  const recipient = `${normalizeWhatsAppNumber(phoneNumber)}@s.whatsapp.net`;
  const otp = String(code || "");
  if (!OTP_PATTERN.test(otp)) throw new Error("code must be a 6-digit OTP");

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
