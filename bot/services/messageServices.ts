import type { WhatsAppClient, GowaMessage } from "./gowaService";
type WASocket = WhatsAppClient;
import { buildExpenseMessage, getExpensesLastMonth, getExpensesThisMonth, saveExpense, saveExpenses } from "./expenseServices";
import { deleteExpenseDraft, getExpenseDraft, reserveReceiptUploadForToday, saveExpenseDraft } from "./expenseDraftService";
import { extractReceipt, type ReceiptExtractionInput, type ReceiptExtractionResult } from "./receiptExtractionService";
import { getTodos, removeTodo, saveTodo } from "./todoServices";
import { getNotes, saveNote } from "./noteServices";
import { getPhoneNumberForUser, hasActiveSubscription, resolveUserId } from "../repositories/userRepository";

export async function handleIncomingMessage(sock: WhatsAppClient, msg: GowaMessage): Promise<void> {
  try {
    const sender = msg.key.remoteJid;
    if (!sender) return;
    const userId = await resolveUserId({ remoteJid: sender, remoteJidAlt: msg.key.remoteJidAlt });
    const phoneNumber = await getPhoneNumberForUser(userId);
    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
    if (!text) return;

    console.log(`[user:${userId}] ${text}`);
    const command = text.trim().toLowerCase();
    if (command === "help" || command === "menu") return showHelp(sock, sender);
    if (command === "simpan" || command === "ya") return handleSaveExpenseDraft(sock, sender, phoneNumber);
    if (command === "pengeluaran bulan ini") return showExpensesThisMonth(sock, sender, phoneNumber);
    if (command === "pengeluaran bulan lalu") return showExpensesLastMonth(sock, sender, phoneNumber);
    if (command === "todo") return showTodos(sock, sender, userId);
    if (text.trim().toLowerCase().startsWith("note:")) return handleNoteInput(sock, sender, text);
    if (text.toLowerCase().startsWith("todo:")) return handleTodoInput(sock, sender, userId, text, phoneNumber);
    if (text.toLowerCase().startsWith("todo remove:")) return handleRemoveTodo(sock, sender, userId, text);
    return handleExpenseInput(sock, sender, text, phoneNumber);
  } catch (error) {
    console.error("Terjadi kesalahan:", error);
  }
}

async function handleReceiptImage(sock: WhatsAppClient, sender: string, userId: bigint, phoneNumber: string | null, msg: GowaMessage): Promise<void> {
  if (!phoneNumber) return sendPhoneNumberRequired(sock, sender);
    const mimeType = "image/jpeg" as ReceiptExtractionInput["mimeType"];
  if (!mimeType) {
    await sock.sendMessage(sender, { text: "Maaf, kirim struk sebagai gambar JPG, PNG, atau WebP." });
    return;
  }

  await sock.sendMessage(sender, { text: "Sedang membaca foto struk Anda…" });
  console.log("Memulai pengecekan limit");
  try {
    const subscribed = await hasActiveSubscription(userId);
    console.log(`Hasil pengecekan, user subscription ${subscribed}`);
    if (!subscribed) {
      const canUpload = await reserveReceiptUploadForToday(phoneNumber);
      console.log(`Hasil pengecekan apakah user bisa upload ${canUpload}`);
      if (!canUpload) {
        await sock.sendMessage(sender, { text: "Saat ini setiap user hanya dapat mengupload 1 foto perhari. Silakan coba lagi besok." });
        return;
      }
    }
  } catch (error) {
    console.error("Receipt upload limit error:", error);
    await sock.sendMessage(sender, { text: "Batas upload sedang tidak tersedia. Silakan coba lagi beberapa saat lagi." });
    return;
  }

  try {
    throw new Error("Gowa media download is not configured");
  } catch (error) {
    console.error("Receipt extraction error:", error);
    await sock.sendMessage(sender, {
      text: "Maaf, foto struk belum dapat dibaca. Pastikan foto jelas, seluruh total terlihat, lalu coba kirim ulang."
    });
  }
}

function getReceiptMimeType(mimeType: string | null | undefined): ReceiptExtractionInput["mimeType"] | null {
  switch ((mimeType || "image/jpeg").toLowerCase()) {
    case "image/jpeg":
    case "image/jpg":
      return "image/jpeg";
    case "image/png":
      return "image/png";
    case "image/webp":
      return "image/webp";
    default:
      return null;
  }
}

function buildReceiptPreview(result: ReceiptExtractionResult): string {
  const amount = result.amount === null ? "Tidak terbaca" : `Rp${result.amount.toLocaleString("id-ID")}`;
  const details = [
    "Hasil pembacaan struk:",
    `Toko: ${result.merchant || "Tidak terbaca"}`,
    `Tanggal: ${result.receiptDate || "Tidak terbaca"}`,
    "Item yang dibeli:",
    ...result.items.map((item) => formatReceiptItem(item.name, item.price)),
    `Kategori: ${result.category || "Belum ditentukan"}`,
    `Total: ${amount}`,
    `Keyakinan: ${Math.round(result.confidence * 100)}%`
  ];

  if (result.warnings.length > 0) details.push(`Catatan: ${result.warnings.slice(0, 3).join("; ")}`);
  details.push("", "Balas SIMPAN atau YA untuk menyimpan. Draft berlaku selama 15 menit.");
  return details.join("\n");
}

async function handleSaveExpenseDraft(sock: WASocket, sender: string, phoneNumber: string | null): Promise<void> {
  if (!phoneNumber) return sendPhoneNumberRequired(sock, sender);
  const draft = await getExpenseDraft(phoneNumber);
  if (!draft) {
    await sock.sendMessage(sender, { text: "Tidak ada draft struk yang aktif. Kirim foto struk terlebih dahulu." });
    return;
  }
  const { receipt } = draft;
  await saveExpenses(phoneNumber, receipt.items, {
    category: receipt.category,
    createdAt: parseReceiptDate(receipt.receiptDate)
  });
  await deleteExpenseDraft(phoneNumber);
  const savedTotal = receipt.items.reduce((sum, item) => sum + item.price, 0);
  await sock.sendMessage(sender, {
    text: `Pengeluaran berhasil disimpan.\nItem yang dibeli:\n${receipt.items.map((item) => formatReceiptItem(item.name, item.price)).join("\n")}\nTotal item tersimpan: Rp${savedTotal.toLocaleString("id-ID")}`
  });
}

function formatReceiptItem(name: string, price: number): string {
  return `- ${name}: Rp${price.toLocaleString("id-ID")}`;
}

function parseReceiptDate(receiptDate: string | null): Date | undefined {
  if (!receiptDate || !/^\d{4}-\d{2}-\d{2}$/.test(receiptDate)) return undefined;
  const parsed = new Date(`${receiptDate}T12:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== receiptDate ? undefined : parsed;
}

async function handleExpenseInput(sock: WASocket, sender: string, text: string, phoneNumber: string | null): Promise<void> {
  const match = text.match(/Beli:\s*(.+)\nHarga:\s*([\d.,]+)/i);
  if (!match) return showHelp(sock, sender);
  const item = match[1].trim();
  const price = Number.parseInt(match[2].replace(/[^\d]/g, ""), 10);
  if (!phoneNumber) return sendPhoneNumberRequired(sock, sender);
  await saveExpense(phoneNumber, item, price);
  await sock.sendMessage(sender, { text: `📝 Pengeluaran dicatat\nBarang: ${item}\nHarga: Rp${price.toLocaleString("id-ID")}` });
}

async function showExpensesThisMonth(sock: WASocket, sender: string, phoneNumber: string | null): Promise<void> {
  if (!phoneNumber) return sendPhoneNumberRequired(sock, sender);
  await sock.sendMessage(sender, { text: buildExpenseMessage("Pengeluaran Bulan Ini", await getExpensesThisMonth(phoneNumber)) });
}

async function showExpensesLastMonth(sock: WASocket, sender: string, phoneNumber: string | null): Promise<void> {
  if (!phoneNumber) return sendPhoneNumberRequired(sock, sender);
  await sock.sendMessage(sender, { text: buildExpenseMessage("Pengeluaran Bulan Lalu", await getExpensesLastMonth(phoneNumber)) });
}

async function handleTodoInput(sock: WASocket, sender: string, userId: bigint, text: string, phoneNumber: string | null): Promise<void> {
  const todoText = text.substring(5).trim();
  if (!todoText) {
    await sock.sendMessage(sender, { text: "Format:\nTodo: Belajar NodeJS" });
    return;
  }
  if (!phoneNumber) return sendPhoneNumberRequired(sock, sender);
  const todo = await saveTodo(userId, phoneNumber, todoText);
  await sock.sendMessage(sender, { text: `📝 Todo berhasil ditambahkan\n\nKode : ${todo.code}\nTodo : ${todo.text}` });
}

async function handleNoteInput(sock: WASocket, sender: string, text: string): Promise<void> {
  const match = text.trim().match(/^note:\s*([^\r\n]+)(?:\r?\n([\s\S]*))?$/i);
  if (!match) {
    await sock.sendMessage(sender, { text: "Format:\nNote: Nama\nFakta" });
    return;
  }

  const name = match[1].trim();
  const fact = match[2]?.trim();
  if (!fact) return showNotes(sock, sender, name);

  await saveNote(name, fact);
  await sock.sendMessage(sender, { text: `Catatan tentang ${name} berhasil disimpan.` });
}

async function showNotes(sock: WASocket, sender: string, name: string): Promise<void> {
  const notes = await getNotes(name);
  if (notes.length === 0) {
    await sock.sendMessage(sender, { text: `Belum ada fakta tentang ${name}.` });
    return;
  }

  const message = `Fakta tentang ${name}:\n\n${notes.map((note, index) => `${index + 1}. ${note.fact}`).join("\n")}`;
  await sock.sendMessage(sender, { text: message });
}

async function sendPhoneNumberRequired(sock: WASocket, sender: string): Promise<void> {
  await sock.sendMessage(sender, { text: "Nomor WhatsApp Anda belum dapat diidentifikasi. Silakan kirim pesan dari nomor utama Anda, lalu coba lagi." });
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
  const message = "📝 Todo List\n\n" + todos.map((todo, index) => `${index + 1}. [${todo.code}] ${todo.text}`).join("\n");
  await sock.sendMessage(sender, { text: message });
}

async function showHelp(sock: WASocket, sender: string): Promise<void> {
  const message = [
    "🤖 Bot Pencatatan Keuangan",
    "",
    "📝 Mencatat Pengeluaran",
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
    "Atau kirim foto struk, lalu balas SIMPAN untuk mencatat hasilnya.",
    "",
    "📊 Melihat Laporan",
    "• pengeluaran bulan ini",
    "• pengeluaran bulan lalu",
    "",
    "• Todo",
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
    "Catatan tentang orang lain",
    "Tambah catatan:",
    "Note: Nama",
    "Fakta",
    "",
    "Lihat semua fakta seseorang:",
    "Note: Nama",
    "",
    "❓ Bantuan",
    "• help",
    "• menu",
    "",
    "Catatan:",
    "- Harga tanpa titik atau koma lebih disarankan.",
    "- Semua pengeluaran akan dicatat berdasarkan nomor WhatsApp masing-masing pengguna."
  ].join("\n");
  await sock.sendMessage(sender, { text: message });
}
