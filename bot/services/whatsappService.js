const {
  default: makeWASocket,
  useMultiFileAuthState
} = require("@whiskeysockets/baileys");
const P = require("pino");
const qrcode = require("qrcode-terminal");

const { handleIncomingMessage } = require("./messageServices");
const { sendOtp } = require("./otpDeliveryService");

let activeSocket = null;
let isWhatsAppConnected = false;
let reconnectTimer = null;

function scheduleReconnect() {
  if (reconnectTimer) return;

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    startWhatsAppBot().catch((error) => {
      console.error("Unable to reconnect WhatsApp:", error);
      scheduleReconnect();
    });
  }, 3_000);
}

async function startWhatsAppBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");
  const socket = makeWASocket({
    auth: state,
    logger: P({ level: "silent" })
  });

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

async function deliverOtp(phoneNumber, code, expiresInMinutes) {
  if (!activeSocket || !isWhatsAppConnected) {
    throw new Error("WhatsApp bot is not connected");
  }

  await sendOtp(activeSocket, phoneNumber, code, expiresInMinutes);
}

module.exports = {
  startWhatsAppBot,
  deliverOtp
};
