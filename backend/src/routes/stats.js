const express = require("express");
const router = express.Router();
const pool = require("../config/db");

// GET /api/stats
router.get("/", async (req, res) => {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Monthly spending + count
    const expenseStatsResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total_amount,
              COUNT(*) AS total_count
       FROM expenses
       WHERE EXTRACT(YEAR FROM created_at) = $1
         AND EXTRACT(MONTH FROM created_at) = $2
         AND user_id = $3;`,
      [currentYear, currentMonth, req.auth.userId]
    );

    const currentMonthSpent = parseFloat(
      expenseStatsResult.rows[0].total_amount
    );
    const currentMonthCount = parseInt(
      expenseStatsResult.rows[0].total_count,
      10
    );

    // Active todos count
    const todoStatsResult = await pool.query(
      "SELECT COUNT(*) AS total_todos FROM todos WHERE user_id = $1;",
      [req.auth.userId]
    );
    const activeTodosCount = parseInt(
      todoStatsResult.rows[0].total_todos,
      10
    );

    // All-time expense count
    const totalExpensesResult = await pool.query(
      "SELECT COUNT(*) AS total_all FROM expenses WHERE user_id = $1;",
      [req.auth.userId]
    );
    const totalExpensesCount = parseInt(
      totalExpensesResult.rows[0].total_all,
      10
    );

    res.json({
      currentMonthSpent,
      currentMonthCount,
      activeTodosCount,
      totalExpensesCount,
      year: currentYear,
      month: currentMonth,
    });
  } catch (err) {
    console.error("GET /api/stats error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch stats" });
  }
});

module.exports = router;
