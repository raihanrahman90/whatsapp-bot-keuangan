import prisma = require("../config/prisma");

type UserId = bigint | number | string;

interface CreateExpenseInput {
  amount: number | string;
  category?: string | null;
  description?: string | null;
  userId?: UserId | null;
  legacySenderId?: string | null;
  createdAt?: Date;
}

function toUserId(userId: UserId): bigint {
  return typeof userId === "bigint" ? userId : BigInt(userId);
}

export async function createExpense(data: CreateExpenseInput) {
  return prisma.expense.create({
    data: {
      amount: data.amount,
      category: data.category || null,
      description: data.description || null,
      userId: data.userId == null ? null : toUserId(data.userId),
      legacySenderId: data.legacySenderId || "",
      createdAt: data.createdAt || new Date()
    }
  });
}

export async function getExpensesForMonth(userId: UserId, year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  return prisma.expense.findMany({
    where: {
      userId: toUserId(userId),
      createdAt: { gte: start, lt: end }
    },
    orderBy: { createdAt: "asc" }
  });
}
