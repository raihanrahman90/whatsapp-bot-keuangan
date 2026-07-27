const express = require("express");
const prisma = require("../../config/prisma");
const { todoToApi } = require("../serializers");
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const todos = await prisma.todo.findMany({
      where: { userId: req.auth.userId },
      orderBy: { createdAt: "desc" }
    });
    return res.json(todos.map((todo) => {
      const serialized = todoToApi(todo);
      return { code: serialized.code, user_id: serialized.user_id, text: serialized.text, created_at: serialized.created_at };
    }));
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
      const exists = await prisma.todo.findUnique({ where: { code: candidate }, select: { id: true } });
      if (!exists) { code = candidate; break; }
    }
    if (!code) return res.status(500).json({ error: "Could not generate unique code" });
    const todo = await prisma.todo.create({ data: { code, userId: req.auth.userId, legacySenderId: "", text, createdAt: new Date() } });
    return res.status(201).json(todoToApi(todo));
  } catch (error) {
    console.error("POST /api/todos error:", error);
    return res.status(500).json({ error: error.message || "Failed to create todo" });
  }
});

async function deleteTodo(req, res) {
  try {
    const code = String(req.params.code || req.query.code || "").toUpperCase();
    if (!code) return res.status(400).json({ error: "Todo code is required" });
    const result = await prisma.todo.deleteMany({ where: { code, userId: req.auth.userId } });
    return res.json({ deleted: result.count > 0 });
  } catch (error) {
    console.error("DELETE /api/todos error:", error);
    return res.status(500).json({ error: error.message || "Failed to delete todo" });
  }
}

router.delete("/", deleteTodo);
router.delete("/:code", deleteTodo);
module.exports = router;
