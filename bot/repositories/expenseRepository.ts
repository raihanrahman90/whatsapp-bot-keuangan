import prisma = require("../config/prisma");

interface CreateExpenseInput {
  amount: number | string;
  category?: string | null;
  description?: string | null;
  whatsappId: string;
  createdAt?: Date;
}

export async function createExpense(data: CreateExpenseInput) {
  return prisma.expense.create({
    data: {
      amount: data.amount,
      category: data.category || null,
      description: data.description || null,
      whatsappId: data.whatsappId,
      createdAt: data.createdAt || new Date()
    }
  });
}

export async function getExpensesForMonth(whatsappId: string, year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  return prisma.expense.findMany({
    where: {
      whatsappId,
      createdAt: { gte: start, lt: end }
    },
    orderBy: { createdAt: "asc" }
  });
}
