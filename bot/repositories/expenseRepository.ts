import prisma = require("../config/prisma");

interface CreateExpenseInput {
  amount: number | string;
  category?: string | null;
  description?: string | null;
  phoneNumber: string;
  createdAt?: Date;
}

export async function createExpense(data: CreateExpenseInput) {
  return prisma.expense.create({
    data: {
      amount: data.amount,
      category: data.category || null,
      description: data.description || null,
      phoneNumber: data.phoneNumber,
      createdAt: data.createdAt || new Date()
    }
  });
}

export async function createExpenses(data: CreateExpenseInput[]) {
  return prisma.expense.createMany({
    data: data.map((expense) => ({
      amount: expense.amount,
      category: expense.category || null,
      description: expense.description || null,
      phoneNumber: expense.phoneNumber,
      createdAt: expense.createdAt || new Date()
    }))
  });
}

export async function getExpensesForMonth(phoneNumber: string, year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  return prisma.expense.findMany({
    where: {
      phoneNumber,
      createdAt: { gte: start, lt: end }
    },
    orderBy: { createdAt: "asc" }
  });
}
