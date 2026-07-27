import type { WASocket } from "@whiskeysockets/baileys" with { "resolution-mode": "import" };
import P from "pino";
import * as qrcode from "qrcode-terminal";
import { handleIncomingMessage } from "./messageServices";
import { sendOtp } from "./otpDeliveryService";

let activeSocket: WASocket | null = null;
let isWhatsAppConnected = false;
let reconnectTimer: NodeJS.Timeout | null = null;

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    startWhatsAppBot().catch((error: unknown) => {
      console.error("Unable to reconnect WhatsApp:", error);
      scheduleReconnect();
    });
  }, 3_000);
}

export async function startWhatsAppBot(): Promise<void> {
  const { default: makeWASocket, useMultiFileAuthState } = await import("@whiskeysockets/baileys");
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");
  const socket = makeWASocket({ auth: state, logger: P({ level: "silent" }) });
  activeSocket = socket;
  socket.ev.on("creds.update", saveCreds);

  socket.ev.on("connection.update", (update) => {
    const { connection, qr, lastDisconnect } = update;
    if (qr) qrcode.generate(qr, { small: true });
    if (connection === "open") {
      isWhatsAppConnected = true;
      console.log("WhatsApp connected");
    }
    if (connection === "close") {
      isWhatsAppConnected = false;
      if (activeSocket === socket) activeSocket = null;
      console.log("WhatsApp disconnected:", lastDisconnect?.error);
      scheduleReconnect();
    }
  });

  socket.ev.on("messages.upsert", async ({ messages }) => {
    const message = messages[0];
    if (!message?.message || message.key.fromMe) return;
    try {
      await handleIncomingMessage(socket, message);
    } catch (error) {
      console.error("Message handler error:", error);
    }
  });
}

export async function deliverOtp(phoneNumber: unknown, code: unknown, expiresInMinutes: number): Promise<void> {
  if (!activeSocket || !isWhatsAppConnected) throw new Error("WhatsApp bot is not connected");
  await sendOtp(activeSocket, phoneNumber, code, expiresInMinutes);
}
