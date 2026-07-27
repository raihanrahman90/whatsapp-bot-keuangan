import type { WAMessage, WASocket } from "@whiskeysockets/baileys" with { "resolution-mode": "import" };
import { buildExpenseMessage, getExpensesLastMonth, getExpensesThisMonth, saveExpense } from "./expenseServices";
import { getTodos, removeTodo, saveTodo } from "./todoServices";
import { resolveUserId } from "../repositories/userRepository";

export async function handleIncomingMessage(sock: WASocket, msg: WAMessage): Promise<void> {
  try {
    const sender = msg.key.remoteJid;
    if (!sender) return;
    const userId = await resolveUserId({ remoteJid: sender, remoteJidAlt: msg.key.remoteJidAlt });
    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
    if (!text) return;

    console.log(`[user:${userId}] ${text}`);
    const command = text.trim().toLowerCase();
    if (command === "help" || command === "menu") return showHelp(sock, sender);
    const whatsappId = getWhatsAppId(sender, msg.key.remoteJidAlt);
    if (command === "pengeluaran bulan ini") return showExpensesThisMonth(sock, sender, whatsappId);
    if (command === "pengeluaran bulan lalu") return showExpensesLastMonth(sock, sender, whatsappId);
    if (command === "todo") return showTodos(sock, sender, userId);
    if (text.toLowerCase().startsWith("todo:")) return handleTodoInput(sock, sender, userId, text);
    if (text.toLowerCase().startsWith("todo remove:")) return handleRemoveTodo(sock, sender, userId, text);
    return handleExpenseInput(sock, sender, text, whatsappId);
  } catch (error) {
    console.error("Terjadi kesalahan:", error);
  }
}

function getWhatsAppId(remoteJid: string, remoteJidAlt?: string | null): string {
  const phoneJid = [remoteJid, remoteJidAlt].find((jid) => String(jid || "").endsWith("@s.whatsapp.net"));
  return (phoneJid || remoteJid).split("@")[0];
}

async function handleExpenseInput(sock: WASocket, sender: string, text: string, whatsappId: string): Promise<void> {
  const match = text.match(/Beli:\s*(.+)\nHarga:\s*([\d.,]+)/i);
  if (!match) return showHelp(sock, sender);
  const item = match[1].trim();
  const price = Number.parseInt(match[2].replace(/[^\d]/g, ""), 10);
  await saveExpense(whatsappId, item, price);
  await sock.sendMessage(sender, { text: `âœ… Pengeluaran dicatat\nBarang: ${item}\nHarga: Rp${price.toLocaleString("id-ID")}` });
}

async function showExpensesThisMonth(sock: WASocket, sender: string, whatsappId: string): Promise<void> {
  await sock.sendMessage(sender, { text: buildExpenseMessage("Pengeluaran Bulan Ini", await getExpensesThisMonth(whatsappId)) });
}

async function showExpensesLastMonth(sock: WASocket, sender: string, whatsappId: string): Promise<void> {
  await sock.sendMessage(sender, { text: buildExpenseMessage("Pengeluaran Bulan Lalu", await getExpensesLastMonth(whatsappId)) });
}

async function handleTodoInput(sock: WASocket, sender: string, userId: bigint, text: string): Promise<void> {
  const todoText = text.substring(5).trim();
  if (!todoText) {
    await sock.sendMessage(sender, { text: "Format:\nTodo: Belajar NodeJS" });
    return;
  }
  const todo = await saveTodo(userId, todoText);
  await sock.sendMessage(sender, { text: `âœ… Todo berhasil ditambahkan\n\nKode : ${todo.code}\nTodo : ${todo.text}` });
}

async function handleRemoveTodo(sock: WASocket, sender: string, userId: bigint, text: string): Promise<void> {
  const code = text.replace(/todo remove:/i, "").trim().toUpperCase();
  const success = await removeTodo(userId, code);
  await sock.sendMessage(sender, { text: success ? `âœ… Todo ${code} berhasil dihapus` : `âŒ Todo ${code} tidak ditemukan` });
}

async function showTodos(sock: WASocket, sender: string, userId: bigint): Promise<void> {
  const todos = await getTodos(userId);
  if (todos.length === 0) {
    await sock.sendMessage(sender, { text: "Belum ada todo." });
    return;
  }
  const message = "ðŸ“ Todo List\n\n" + todos.map((todo, index) => `${index + 1}. [${todo.code}] ${todo.text}`).join("\n");
  await sock.sendMessage(sender, { text: message });
}

async function showHelp(sock: WASocket, sender: string): Promise<void> {
  const message = [
    "ðŸ¤– Bot Pencatatan Keuangan",
    "",
    "ðŸ“ Mencatat Pengeluaran",
    "Format:",
    "",
    "Beli: Nama Barang",
    "Harga: Nominal",
    "",
    "Contoh:",
    "Beli: Ayam Geprek",
    "Harga: 25000",
    "",
    "Beli: Bensin",
    "Harga: 50000",
    "",
    "ðŸ“Š Melihat Laporan",
    "â€¢ pengeluaran bulan ini",
    "â€¢ pengeluaran bulan lalu",
    "",
    "ðŸ“ Todo",
    "",
    "Tambah Todo",
    "Todo: Belajar Spring Boot",
    "",
    "Lihat Todo",
    "todo",
    "",
    "Hapus Todo",
    "Remove Todo: A7KD",
    "",
    "â“ Bantuan",
    "â€¢ help",
    "â€¢ menu",
    "",
    "Catatan:",
    "- Harga tanpa titik atau koma lebih disarankan.",
    "- Semua pengeluaran akan dicatat berdasarkan nomor WhatsApp masing-masing pengguna."
  ].join("\n");
  await sock.sendMessage(sender, { text: message });
}
