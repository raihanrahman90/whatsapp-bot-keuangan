const express = require("express");
const router = express.Router();
const pool = require("../config/db");

// GET /api/todos
router.get("/", async (req, res) => {
  try {
    const query = `
      SELECT code, user_id, text, created_at
      FROM todos
      WHERE user_id = $1
      ORDER BY created_at DESC;
    `;

    const result = await pool.query(query, [req.auth.userId]);
    res.json(result.rows);
  } catch (err) {
    console.error("GET /api/todos error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch todos" });
  }
});

// POST /api/todos
router.post("/", async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res
        .status(400)
        .json({ error: "Missing required field: text" });
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

    const result = await pool.query(query, [code, req.auth.userId, text]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("POST /api/todos error:", err);
    res.status(500).json({ error: err.message || "Failed to create todo" });
  }
});

// DELETE /api/todos/:code
async function deleteTodo(req, res) {
  try {
    const code = String(req.params.code || req.query.code || "").toUpperCase();
    if (!code) {
      return res.status(400).json({ error: "Todo code is required" });
    }

    const result = await pool.query(
      "DELETE FROM todos WHERE code = $1 AND user_id = $2",
      [code, req.auth.userId]
    );
    res.json({ deleted: (result.rowCount ?? 0) > 0 });
  } catch (err) {
    console.error("DELETE /api/todos error:", err);
    res.status(500).json({ error: err.message || "Failed to delete todo" });
  }
}

router.delete("/", deleteTodo);
router.delete("/:code", deleteTodo);

module.exports = router;
