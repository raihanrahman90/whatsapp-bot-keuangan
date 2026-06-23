const fs = require("fs");
const path = require("path");

const FILE_NAME = path.join(process.cwd(), "expenses.json");
function readExpenses() {
  if (!fs.existsSync(FILE_NAME)) {
    return [];
  }

  return JSON.parse(
    fs.readFileSync(FILE_NAME, "utf8")
  );
}

function saveExpense(userId, item, price) {
  if (!userId || !item || !price) return;
  if (isNaN(price)) throw new Error("Price must be number");
  let expenses = [];

  if (fs.existsSync(FILE_NAME)) {
    expenses = JSON.parse(
      fs.readFileSync(FILE_NAME, "utf8")
    );
  }

  expenses.push({
    userId,
    item,
    price,
    createdAt: new Date().toISOString()
  });

  fs.writeFileSync(
    FILE_NAME,
    JSON.stringify(expenses, null, 2)
  );
}

function getExpensesThisMonth(userId) {
  const now = new Date();

  return readExpenses().filter((e) => {
    const date = new Date(e.createdAt);

    return (
      e.userId === userId &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    );
  });
}

function getExpensesLastMonth(userId) {
  const now = new Date();

  const lastMonth =
    now.getMonth() === 0
      ? 11
      : now.getMonth() - 1;

  const year =
    now.getMonth() === 0
      ? now.getFullYear() - 1
      : now.getFullYear();

  return readExpenses().filter((e) => {
    const date = new Date(e.createdAt);

    return (
      e.userId === userId &&
      date.getMonth() === lastMonth &&
      date.getFullYear() === year
    );
  });
}

module.exports = {
  saveExpense,
  getExpensesThisMonth,
  getExpensesLastMonth
};