import express = require("express");
import prisma = require("../../config/prisma");
import serializers = require("../serializers");
import { getErrorMessage, type AuthenticatedRequest } from "../types";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const auth = (req as AuthenticatedRequest).auth;
    const todos = await prisma.todo.findMany({
      where: { userId: auth.userId },
      orderBy: { createdAt: "desc" }
    });
    return res.json(todos.map((todo) => {
      const serialized = serializers.todoToApi(todo);
      return { code: serialized.code, whatsapp_id: serialized.whatsapp_id, text: serialized.text, created_at: serialized.created_at };
    }));
  } catch (error) {
    const message = getErrorMessage(error, "Failed to fetch todos");
    console.error("GET /api/todos error:", error);
    return res.status(500).json({ error: message });
  }
});

router.post("/", async (req, res) => {
  try {
    const auth = (req as AuthenticatedRequest).auth;
    const { text } = (req.body || {}) as { text?: string };
    if (!text) return res.status(400).json({ error: "Missing required field: text" });
    if (!auth.whatsappId) return res.status(409).json({ error: "WhatsApp identity not found for this account" });

    let code: string | undefined;
    for (let attempts = 0; attempts < 10; attempts += 1) {
      const candidate = Math.random().toString(36).substring(2, 4).toUpperCase();
      const exists = await prisma.todo.findUnique({ where: { code: candidate }, select: { id: true } });
      if (!exists) { code = candidate; break; }
    }
    if (!code) return res.status(500).json({ error: "Could not generate unique code" });

    const todo = await prisma.todo.create({
      data: { code, userId: auth.userId, whatsappId: auth.whatsappId, text, createdAt: new Date() }
    });
    return res.status(201).json(serializers.todoToApi(todo));
  } catch (error) {
    const message = getErrorMessage(error, "Failed to create todo");
    console.error("POST /api/todos error:", error);
    return res.status(500).json({ error: message });
  }
});

async function deleteTodo(req: AuthenticatedRequest, res: express.Response) {
  try {
    const code = String(req.params.code || req.query.code || "").toUpperCase();
    if (!code) return res.status(400).json({ error: "Todo code is required" });
    const result = await prisma.todo.deleteMany({ where: { code, userId: req.auth.userId } });
    return res.json({ deleted: result.count > 0 });
  } catch (error) {
    const message = getErrorMessage(error, "Failed to delete todo");
    console.error("DELETE /api/todos error:", error);
    return res.status(500).json({ error: message });
  }
}

router.delete("/", (req, res) => deleteTodo(req as unknown as AuthenticatedRequest, res));
router.delete("/:code", (req, res) => deleteTodo(req as unknown as AuthenticatedRequest, res));

export = router;
