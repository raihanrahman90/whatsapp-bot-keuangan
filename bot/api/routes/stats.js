const express = require("express");
const prisma = require("../../config/prisma");
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const monthStart = new Date(year, month - 1, 1);
    const nextMonthStart = new Date(year, month, 1);
    const [expenseStats, activeTodosCount, totalExpensesCount] = await Promise.all([
      prisma.expense.aggregate({
        where: { userId: req.auth.userId, createdAt: { gte: monthStart, lt: nextMonthStart } },
        _sum: { amount: true },
        _count: { _all: true }
      }),
      prisma.todo.count({ where: { userId: req.auth.userId } }),
      prisma.expense.count({ where: { userId: req.auth.userId } })
    ]);
    return res.json({
      currentMonthSpent: Number(expenseStats._sum.amount || 0),
      currentMonthCount: expenseStats._count._all,
      activeTodosCount,
      totalExpensesCount,
      year,
      month
    });
  } catch (error) {
    console.error("GET /api/stats error:", error);
    return res.status(500).json({ error: error.message || "Failed to fetch stats" });
  }
});

module.exports = router;
