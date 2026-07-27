const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");
const {
  handleIncomingMessage
} = require("./services/messageServices");
const { startOtpDeliveryBridge } = require("./services/otpDeliveryBridge");
const { migrateJsonToDb: migrateExpensesJsonToDb } = require("./services/expenseServices");
const { migrateJsonToDb: migrateTodosJsonToDb } = require("./services/todoServices");

const P = require("pino");
const qrcode = require("qrcode-terminal");

let activeSocket = null;
let isWhatsAppConnected = false;

startOtpDeliveryBridge({
  getSocket: () => activeSocket,
  isWhatsAppConnected: () => isWhatsAppConnected
});

async function startBot() {

  const { state, saveCreds } =
    await useMultiFileAuthState("auth_info");

  const sock = makeWASocket({
    auth: state,
    logger: P({ level: "silent" })
  });
  activeSocket = sock;

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, qr, lastDisconnect } = update;

    if (qr) {
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      isWhatsAppConnected = true;
      console.log("WhatsApp Connected");
    }

    if (connection === "close") {
        isWhatsAppConnected = false;
        startBot();
    }
    if (lastDisconnect) {
        console.log("Disconnect reason:", lastDisconnect.error);
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];

    if (!msg.message) return;
    if (msg.key.fromMe) return;

    const sender = msg.key.remoteJid;
    try {
      handleIncomingMessage(sock, msg);
    }
    catch (err) {
      console.error("Message handler error:", err);
    }
  });
}

startBot(); 
