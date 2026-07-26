const express = require("express");
const router = express.Router();
const pool = require("../config/db");

// GET /api/todos
router.get("/", async (req, res) => {
  try {
    const { userId } = req.query;

    let query = "SELECT code, user_id, text, created_at FROM todos";
    const params = [];

    if (userId) {
      params.push(userId);
      query += " WHERE user_id = $1";
    }

    query += " ORDER BY created_at DESC;";

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("GET /api/todos error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch todos" });
  }
});

// POST /api/todos
router.post("/", async (req, res) => {
  try {
    const { userId, text } = req.body;

    if (!userId || !text) {
      return res
        .status(400)
        .json({ error: "Missing required fields: userId, text" });
    }

    // Generate a unique 2-char code (retry on collision)
    let code;
    let attempts = 0;
    while (attempts < 10) {
      const candidate = Math.random().toString(36).substring(2, 4).toUpperCase();
      const check = await pool.query("SELECT 1 FROM todos WHERE code = $1", [
        candidate,
      ]);
      if (check.rowCount === 0) {
        code = candidate;
        break;
      }
      attempts++;
    }

    if (!code) {
      return res.status(500).json({ error: "Could not generate unique code" });
    }

    const query = `
      INSERT INTO todos (code, user_id, text, created_at)
      VALUES ($1, $2, $3, NOW())
      RETURNING *;
    `;

    const result = await pool.query(query, [code, userId, text]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("POST /api/todos error:", err);
    res.status(500).json({ error: err.message || "Failed to create todo" });
  }
});

// DELETE /api/todos/:code
router.delete("/:code", async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const { userId } = req.query;

    let query = "DELETE FROM todos WHERE code = $1";
    const params = [code];

    if (userId) {
      query += " AND user_id = $2";
      params.push(userId);
    }

    const result = await pool.query(query, params);
    res.json({ deleted: (result.rowCount ?? 0) > 0 });
  } catch (err) {
    console.error("DELETE /api/todos error:", err);
    res.status(500).json({ error: err.message || "Failed to delete todo" });
  }
});

module.exports = router;
