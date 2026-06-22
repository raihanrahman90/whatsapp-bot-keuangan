const { saveExpense, getExpensesLastMonth, getExpensesThisMonth } = require("./expenseServices");

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
      case "pengeluaran bulan ini":
        return showExpensesThisMonth(sock, sender, userId);

      case "pengeluaran bulan lalu":
        return showExpensesLastMonth(sock, sender, userId);

      default:
        return handleExpenseInput(
          sock,
          sender,
          userId,
          text
        );
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
    await sock.sendMessage(sender, {
      text: "Format tidak dikenali."
    });
    return;
  }

  const item = match[1].trim();

  const price = parseInt(
    match[2].replace(/[^\d]/g, "")
  );

  saveExpense(userId, item, price);

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
    getExpensesThisMonth(userId);

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
    getExpensesLastMonth(userId);

  const message = buildExpenseMessage(
    "Pengeluaran Bulan Lalu",
    expenses
  );

  await sock.sendMessage(sender, {
    text: message
  });
}

function buildExpenseMessage(
  title,
  expenses
) {
  if (expenses.length === 0) {
    return `Belum ada ${title.toLowerCase()}.`;
  }

  let total = 0;

  const details = expenses
    .map((e, index) => {
      total += e.price;

      return (
        `${index + 1}. ${e.item}\n` +
        `Rp${e.price.toLocaleString("id-ID")}`
      );
    })
    .join("\n\n");

  return (
    `📒 ${title}\n\n` +
    `${details}\n\n` +
    `💰 Total: Rp${total.toLocaleString("id-ID")}`
  );
}

module.exports = {
  handleIncomingMessage
};