const { saveExpense, getExpensesLastMonth, getExpensesThisMonth, buildExpenseMessage } = require("./expenseServices");
const {
  saveTodo,
  removeTodo,
  getTodos
} = require("./todoServices");

async function handleIncomingMessage(sock, msg) {
  try {
    const sender = msg.key.remoteJid;
    const userId = sender.split("@")[0];

    const text =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text;

    if (!text) return;

    console.log(`[${userId}] ${text}`);

    const command = text.trim().toLowerCase();

    switch (command) {
      case "help":
      case "menu":
        return showHelp(sock, sender);
      case "pengeluaran bulan ini":
        return showExpensesThisMonth(sock, sender, userId);

      case "pengeluaran bulan lalu":
        return showExpensesLastMonth(sock, sender, userId);

      case "todo":
        return showTodos(sock, sender, userId);
      default:
        if (text.toLowerCase().startsWith("todo:")) {
          return handleTodoInput(sock, sender, userId, text);
        }

        if (text.toLowerCase().startsWith("todo remove:")) {
          return handleRemoveTodo(sock, sender, userId, text);
        }

        return handleExpenseInput(sock, sender, userId, text);
    }
  } catch (err) {
    console.error("Terjadi kesalahan:", err);
  }
}

async function handleExpenseInput(
  sock,
  sender,
  userId,
  text
) {
  const regex =
    /Beli:\s*(.+)\nHarga:\s*([\d.,]+)/i;

  const match = text.match(regex);

  if (!match) {
    return showHelp(sock, sender);
  }

  const item = match[1].trim();

  const price = parseInt(
    match[2].replace(/[^\d]/g, "")
  );

  await saveExpense(userId, item, price);

  await sock.sendMessage(sender, {
    text:
      `✅ Pengeluaran dicatat\n` +
      `Barang: ${item}\n` +
      `Harga: Rp${price.toLocaleString("id-ID")}`
  });
}

async function showExpensesThisMonth(
  sock,
  sender,
  userId
) {
  const expenses =
    await getExpensesThisMonth(userId);

  const message = buildExpenseMessage(
    "Pengeluaran Bulan Ini",
    expenses
  );

  await sock.sendMessage(sender, {
    text: message
  });
}

async function showExpensesLastMonth(
  sock,
  sender,
  userId
) {
  const expenses =
    await getExpensesLastMonth(userId);

  const message = buildExpenseMessage(
    "Pengeluaran Bulan Lalu",
    expenses
  );

  await sock.sendMessage(sender, {
    text: message
  });
}

async function handleTodoInput(
  sock,
  sender,
  userId,
  text
) {
  const todoText = text.substring(5).trim();

  if (!todoText) {
    return sock.sendMessage(sender, {
      text: "Format:\nTodo: Belajar NodeJS"
    });
  }

  const todo = await saveTodo(userId, todoText);

  await sock.sendMessage(sender, {
    text:
      `✅ Todo berhasil ditambahkan\n\n` +
      `Kode : ${todo.code}\n` +
      `Todo : ${todo.text}`
  });
}

async function handleRemoveTodo(
  sock,
  sender,
  userId,
  text
) {
  const code = text
    .replace(/todo remove:/i, "")
    .trim()
    .toUpperCase();

  const success = await removeTodo(userId, code);

  await sock.sendMessage(sender, {
    text: success
      ? `✅ Todo ${code} berhasil dihapus`
      : `❌ Todo ${code} tidak ditemukan`
  });
}

async function showTodos(
  sock,
  sender,
  userId
) {
  const todos = await getTodos(userId);

  if (todos.length === 0) {
    return sock.sendMessage(sender, {
      text: "Belum ada todo."
    });
  }

  const message =
    "📝 Todo List\n\n" +
    todos
      .map(
        (t, i) =>
          `${i + 1}. [${t.code}] ${t.text}`
      )
      .join("\n");

  await sock.sendMessage(sender, {
    text: message
  });
}

async function showHelp(sock, sender) {
  const message = `
🤖 Bot Pencatatan Keuangan

📝 Mencatat Pengeluaran
Format:

Beli: Nama Barang
Harga: Nominal

Contoh:
Beli: Ayam Geprek
Harga: 25000

Beli: Bensin
Harga: 50000

📊 Melihat Laporan
• pengeluaran bulan ini
• pengeluaran bulan lalu

📝 Todo

Tambah Todo
Todo: Belajar Spring Boot

Lihat Todo
todo

Hapus Todo
Remove Todo: A7KD

❓ Bantuan
• help
• menu

Catatan:
- Harga tanpa titik atau koma lebih disarankan.
- Semua pengeluaran akan dicatat berdasarkan nomor WhatsApp masing-masing pengguna.
`;

  await sock.sendMessage(sender, {
    text: message.trim()
  });
}

module.exports = {
  handleIncomingMessage
};