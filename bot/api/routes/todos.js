const express = require("express");
const pool = require("../../config/database");
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT code, user_id, text, created_at FROM todos WHERE user_id = $1 ORDER BY created_at DESC", [req.auth.userId]);
    return res.json(result.rows);
  } catch (error) {
    console.error("GET /api/todos error:", error);
    return res.status(500).json({ error: error.message || "Failed to fetch todos" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { text } = req.body || {};
    if (!text) return res.status(400).json({ error: "Missing required field: text" });
    let code;
    for (let attempts = 0; attempts < 10; attempts += 1) {
      const candidate = Math.random().toString(36).substring(2, 4).toUpperCase();
      const exists = await pool.query("SELECT 1 FROM todos WHERE code = $1", [candidate]);
      if (!exists.rowCount) { code = candidate; break; }
    }
    if (!code) return res.status(500).json({ error: "Could not generate unique code" });
    const result = await pool.query("INSERT INTO todos (code, user_id, text, created_at) VALUES ($1, $2, $3, NOW()) RETURNING *", [code, req.auth.userId, text]);
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("POST /api/todos error:", error);
    return res.status(500).json({ error: error.message || "Failed to create todo" });
  }
});

async function deleteTodo(req, res) {
  try {
    const code = String(req.params.code || req.query.code || "").toUpperCase();
    if (!code) return res.status(400).json({ error: "Todo code is required" });
    const result = await pool.query("DELETE FROM todos WHERE code = $1 AND user_id = $2", [code, req.auth.userId]);
    return res.json({ deleted: (result.rowCount || 0) > 0 });
  } catch (error) {
    console.error("DELETE /api/todos error:", error);
    return res.status(500).json({ error: error.message || "Failed to delete todo" });
  }
}

router.delete("/", deleteTodo);
router.delete("/:code", deleteTodo);
module.exports = router;
