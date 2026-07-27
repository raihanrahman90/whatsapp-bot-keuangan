const express = require("express");
const pool = require("../../config/database");
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { month, year } = req.query;
    const params = [req.auth.userId];
    const conditions = ["user_id = $1"];
    if (year) { params.push(year); conditions.push(`EXTRACT(YEAR FROM created_at) = $${params.length}`); }
    if (month) { params.push(month); conditions.push(`EXTRACT(MONTH FROM created_at) = $${params.length}`); }
    const result = await pool.query(`SELECT id, user_id, amount, category, description, created_at FROM expenses WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC LIMIT 100`, params);
    console.log("GET /api/expenses", {
      phoneNumber: req.auth.phoneNumber,
      userId: req.auth.userId,
      year: year || null,
      month: month || null,
      resultCount: result.rowCount
    });
    return res.json(result.rows);
  } catch (error) {
    console.error("GET /api/expenses error:", error);
    return res.status(500).json({ error: error.message || "Failed to fetch expenses" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { description, amount, category } = req.body || {};
    if (!description || amount === undefined) return res.status(400).json({ error: "Missing required fields: description, amount" });
    const result = await pool.query("INSERT INTO expenses (user_id, description, amount, category, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING *", [req.auth.userId, description, amount, category || null]);
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("POST /api/expenses error:", error);
    return res.status(500).json({ error: error.message || "Failed to create expense" });
  }
});

module.exports = router;
