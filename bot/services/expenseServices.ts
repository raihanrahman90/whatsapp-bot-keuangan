import * as fs from "node:fs";
import * as path from "node:path";
import { createExpense, getExpensesForMonth } from "../repositories/expenseRepository";
import { formatPrice, truncate } from "../utils/formatters";

export interface ExpenseSummary {
  id: bigint;
  whatsappId: string;
  item: string | null;
  price: number;
  createdAt: Date | null;
}

interface LegacyExpense {
  item?: string;
  price?: number | string;
  createdAt?: string;
}

function getFilePath(filename: string): string {
  const dataPath = path.join(process.cwd(), "data", filename);
  if (fs.existsSync(dataPath)) return dataPath;

  const rootPath = path.join(process.cwd(), filename);
  return fs.existsSync(rootPath) ? rootPath : dataPath;
}

function mapRowToExpense(row: Awaited<ReturnType<typeof createExpense>>): ExpenseSummary {
  return {
    id: row.id,
    whatsappId: row.whatsappId,
    item: row.description,
    price: Number(row.amount),
    createdAt: row.createdAt
  };
}

export async function saveExpense(whatsappId: string, item: string, price: number): Promise<void> {
  if (!whatsappId || !item || !price) return;
  if (Number.isNaN(price)) throw new Error("Price must be number");

  await createExpense({ whatsappId, description: item, amount: price, createdAt: new Date() });
}

export async function getExpensesThisMonth(whatsappId: string): Promise<ExpenseSummary[]> {
  const now = new Date();
  const rows = await getExpensesForMonth(whatsappId, now.getFullYear(), now.getMonth() + 1);
  return rows.map(mapRowToExpense);
}

export async function getExpensesLastMonth(whatsappId: string): Promise<ExpenseSummary[]> {
  const now = new Date();
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const rows = await getExpensesForMonth(whatsappId, lastMonthDate.getFullYear(), lastMonthDate.getMonth() + 1);
  return rows.map(mapRowToExpense);
}

export function buildExpenseMessage(title: string, expenses: ExpenseSummary[]): string {
  if (expenses.length === 0) return `Belum ada ${title.toLowerCase()}.`;

  let total = 0;
  const header = `${"No".padEnd(4)}${"Barang".padEnd(12)}${"Harga".padStart(12)}`;
  const separator = "-".repeat(28);
  const rows = expenses.map((expense, index) => {
    total += expense.price;
    return `${String(index + 1).padEnd(4)}${truncate(expense.item || "").padEnd(12)}${formatPrice(expense.price)}`;
  });
  const footer = `${"Total".padEnd(16)}${formatPrice(total)}`;
  return `ðŸ“’ ${title}\n\n\`\`\`\n${header}\n${separator}\n${rows.join("\n")}\n${separator}\n${footer}\n\`\`\``;
}
