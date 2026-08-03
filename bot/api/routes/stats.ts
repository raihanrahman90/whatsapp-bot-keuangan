import express = require("express");
import prisma = require("../../config/prisma");
import { getErrorMessage, type AuthenticatedRequest } from "../types";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const auth = (req as AuthenticatedRequest).auth;
    const categoryQuery = typeof req.query.category === "string" ? req.query.category : undefined;
    const category = categoryQuery?.trim() || undefined;
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const monthStart = new Date(year, month - 1, 1);
    const nextMonthStart = new Date(year, month, 1);
    const expenseWhere = { phoneNumber: auth.phoneNumber, ...(category ? { category } : {}) };
    const [expenseStats, activeTodosCount, totalExpensesCount] = await Promise.all([
      prisma.expense.aggregate({
        where: { ...expenseWhere, createdAt: { gte: monthStart, lt: nextMonthStart } },
        _sum: { amount: true },
        _count: { _all: true }
      }),
      prisma.todo.count({ where: { userId: auth.userId } }),
      prisma.expense.count({ where: expenseWhere })
    ]);
    return res.json({
      currentMonthSpent: Number(expenseStats._sum.amount || 0),
      currentMonthCount: expenseStats._count._all,
      activeTodosCount,
      totalExpensesCount,
      category: category || null,
      year,
      month
    });
  } catch (error) {
    const message = getErrorMessage(error, "Failed to fetch stats");
    console.error("GET /api/stats error:", error);
    return res.status(500).json({ error: message });
  }
});

export = router;
