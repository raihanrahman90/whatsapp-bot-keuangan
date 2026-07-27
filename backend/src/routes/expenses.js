const express = require("express");
const router = express.Router();
const pool = require("../config/db");

// GET /api/expenses
router.get("/", async (req, res) => {
  try {
    const { month, year } = req.query;

    let query =
      "SELECT id, user_id, amount, category, description, created_at FROM expenses";
    const params = [req.auth.userId];
    const conditions = ["user_id = $1"];

    if (year) {
      params.push(year);
      conditions.push(`EXTRACT(YEAR FROM created_at) = $${params.length}`);
    }

    if (month) {
      params.push(month);
      conditions.push(`EXTRACT(MONTH FROM created_at) = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY created_at DESC LIMIT 100;";

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("GET /api/expenses error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch expenses" });
  }
});

// POST /api/expenses
router.post("/", async (req, res) => {
  try {
    const { description, amount, category } = req.body;

    if (!description || amount === undefined) {
      return res
        .status(400)
        .json({ error: "Missing required fields: description, amount" });
    }

    const query = `
      INSERT INTO expenses (user_id, description, amount, category, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING *;
    `;

    const result = await pool.query(query, [
      req.auth.userId,
      description,
      amount,
      category || null,
    ]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("POST /api/expenses error:", err);
    res.status(500).json({ error: err.message || "Failed to create expense" });
  }
});

module.exports = router;
