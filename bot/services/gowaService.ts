import crypto from "node:crypto";
export interface WhatsAppClient { sendMessage(to: string, message: { text: string }): Promise<void>; }
export interface GowaMessage { key: { remoteJid: string; remoteJidAlt?: string }; message?: { conversation?: string; extendedTextMessage?: { text?: string } }; }
const baseUrl = (process.env.GOWA_URL || "http://gowa:3000").replace(/\/$/, "");
export const gowaClient: WhatsAppClient = { async sendMessage(to, message) {
  const response = await fetch(`${baseUrl}/send/message`, { method: "POST", headers: { "content-type": "application/json", ...authHeaders() }, body: JSON.stringify({ phone: to, message: message.text }) });
  if (!response.ok) throw new Error(`Gowa send failed (${response.status}): ${await response.text()}`);
} };
function authHeaders(): Record<string, string> { const h: Record<string, string> = {}; if (process.env.GOWA_BASIC_AUTH) h.authorization = `Basic ${Buffer.from(process.env.GOWA_BASIC_AUTH).toString("base64")}`; if (process.env.GOWA_DEVICE_ID) h["X-Device-Id"] = process.env.GOWA_DEVICE_ID; return h; }
export function verifyGowaSignature(rawBody: Buffer, signature?: string): boolean { const secret = process.env.GOWA_WEBHOOK_SECRET; if (!secret) return true; if (!signature) return false; const expected = `sha256=${crypto.createHmac("sha256", secret).update(rawBody).digest("hex")}`; return signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected)); }
export function toGowaMessage(payload: any): GowaMessage | null { if (!payload?.from || !payload?.chat_id) return null; const body = typeof payload.body === "string" ? payload.body : undefined; return { key: { remoteJid: payload.chat_id, remoteJidAlt: payload.from }, message: body ? { conversation: body } : undefined }; }
