const express = require("express");
const pool = require("../../config/database");
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const [expenseStats, todoStats, expenseCount] = await Promise.all([
      pool.query("SELECT COALESCE(SUM(amount), 0) AS total_amount, COUNT(*) AS total_count FROM expenses WHERE EXTRACT(YEAR FROM created_at) = $1 AND EXTRACT(MONTH FROM created_at) = $2 AND user_id = $3", [year, month, req.auth.userId]),
      pool.query("SELECT COUNT(*) AS total_todos FROM todos WHERE user_id = $1", [req.auth.userId]),
      pool.query("SELECT COUNT(*) AS total_all FROM expenses WHERE user_id = $1", [req.auth.userId])
    ]);
    return res.json({
      currentMonthSpent: parseFloat(expenseStats.rows[0].total_amount),
      currentMonthCount: parseInt(expenseStats.rows[0].total_count, 10),
      activeTodosCount: parseInt(todoStats.rows[0].total_todos, 10),
      totalExpensesCount: parseInt(expenseCount.rows[0].total_all, 10),
      year,
      month
    });
  } catch (error) {
    console.error("GET /api/stats error:", error);
    return res.status(500).json({ error: error.message || "Failed to fetch stats" });
  }
});

module.exports = router;
