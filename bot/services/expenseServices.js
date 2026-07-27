const fs = require("fs");
const path = require("path");
const { truncate, formatPrice } = require("../utils/formatters");
const expenseRepository = require("../repositories/expenseRepository");

function getFilePath(filename) {
  const dataPath = path.join(process.cwd(), "data", filename);
  if (fs.existsSync(dataPath)) {
    return dataPath;
  }
  const rootPath = path.join(process.cwd(), filename);
  if (fs.existsSync(rootPath)) {
    return rootPath;
  }
  return dataPath;
}

function mapRowToExpense(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.userId,
    item: row.description,
    price: parseFloat(row.amount),
    createdAt: row.createdAt
  };
}

async function saveExpense(userId, item, price) {
  if (!userId || !item || !price) return;
  if (isNaN(price)) throw new Error("Price must be number");

  await expenseRepository.createExpense({
    userId,
    description: item,
    amount: price,
    createdAt: new Date()
  });
}

async function getExpensesThisMonth(userId) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-indexed for PG

  const rows = await expenseRepository.getExpensesForMonth(userId, year, month);
  return rows.map(mapRowToExpense);
}

async function getExpensesLastMonth(userId) {
  const now = new Date();
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const year = lastMonthDate.getFullYear();
  const month = lastMonthDate.getMonth() + 1; // 1-indexed for PG

  const rows = await expenseRepository.getExpensesForMonth(userId, year, month);
  return rows.map(mapRowToExpense);
}

function buildExpenseMessage(title, expenses) {
  if (expenses.length === 0) {
    return `Belum ada ${title.toLowerCase()}.`;
  }

  let total = 0;

  const header =
    `${"No".padEnd(4)}` +
    `${"Barang".padEnd(12)}` +
    `${"Harga".padStart(12)}`;

  const separator = "-".repeat(28);

  const rows = expenses.map((e, index) => {
    total += e.price;

    return (
      `${String(index + 1).padEnd(4)}` +
      `${truncate(e.item).padEnd(12)}` +
      `${formatPrice(e.price)}`
    );
  });

  const footer =
    `${"Total".padEnd(16)}` +
    `${formatPrice(total)}`;

  return (
    `📒 ${title}\n\n` +
    "```\n" +
    header + "\n" +
    separator + "\n" +
    rows.join("\n") + "\n" +
    separator + "\n" +
    footer + "\n" +
    "```"
  );
}

async function migrateJsonToDb() {
  const targetFile = getFilePath("expenses.json");
  if (!fs.existsSync(targetFile)) {
    console.log("expenses.json not found, skipping migration");
    return;
  }

  try {
    const data = fs.readFileSync(targetFile, "utf8");
    const expenses = JSON.parse(data);

    if (Array.isArray(expenses) && expenses.length > 0) {
      console.log(`[Migration] Found ${expenses.length} expenses in ${path.basename(targetFile)}. Migrating to database...`);
      for (const expense of expenses) {
        await expenseRepository.createExpense({
          userId: expense.userId,
          description: expense.item,
          amount: expense.price,
          createdAt: expense.createdAt ? new Date(expense.createdAt) : new Date()
        });
      }
      console.log(`[Migration] Successfully migrated ${expenses.length} expenses to database.`);
    }

    // Rename file to backup to avoid running migration again next time
    const backupName = targetFile + ".bak";
    fs.renameSync(targetFile, backupName);
    console.log(`[Migration] Renamed ${path.basename(targetFile)} to ${path.basename(backupName)}`);
  } catch (err) {
    console.error("[Migration] Failed to migrate expenses.json:", err);
  }
}

module.exports = {
  saveExpense,
  getExpensesThisMonth,
  getExpensesLastMonth,
  buildExpenseMessage,
  migrateJsonToDb
};
