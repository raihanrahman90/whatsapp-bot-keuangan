import express = require("express");
import prisma = require("../../config/prisma");
import serializers = require("../serializers");
import { getErrorMessage, type AuthenticatedRequest } from "../types";
import { getWhatsAppIdsForUser } from "../../repositories/userRepository";

const router = express.Router();

router.get("/categories", async (req, res) => {
  try {
    const auth = (req as AuthenticatedRequest).auth;
    const whatsappIds = await getWhatsAppIdsForUser(auth.userId, auth.phoneNumber);
    const rows = await prisma.expense.findMany({
      where: { whatsappId: { in: whatsappIds }, category: { not: null } },
      distinct: ["category"],
      select: { category: true },
      orderBy: { category: "asc" }
    });
    const categories = rows
      .map((expense) => expense.category?.trim())
      .filter((category): category is string => Boolean(category));
    return res.json(categories);
  } catch (error) {
    const message = getErrorMessage(error, "Failed to fetch expense categories");
    console.error("GET /api/expenses/categories error:", error);
    return res.status(500).json({ error: message });
  }
});

router.get("/", async (req, res) => {
  try {
    const auth = (req as AuthenticatedRequest).auth;
    const { month, year, category: categoryQuery } = req.query as { month?: string; year?: string; category?: string };
    const category = categoryQuery?.trim() || undefined;
    const whatsappIds = await getWhatsAppIdsForUser(auth.userId, auth.phoneNumber);
    const expenses = await prisma.expense.findMany({
      where: { whatsappId: { in: whatsappIds }, ...(category ? { category } : {}) },
      orderBy: { createdAt: "desc" }
    });
    const filtered = expenses
      .filter((expense) => {
        if (!expense.createdAt) return !year && !month;
        return (!year || expense.createdAt.getFullYear() === Number(year)) &&
          (!month || expense.createdAt.getMonth() + 1 === Number(month));
      })
      .slice(0, 100);
    console.log("GET /api/expenses", { whatsappId: auth.whatsappId || auth.phoneNumber, year: year || null, month: month || null, category: category || null, resultCount: filtered.length });
    return res.json(filtered.map(serializers.expenseToApi));
  } catch (error) {
    const message = getErrorMessage(error, "Failed to fetch expenses");
    console.error("GET /api/expenses error:", error);
    return res.status(500).json({ error: message });
  }
});

router.post("/", async (req, res) => {
  try {
    const auth = (req as AuthenticatedRequest).auth;
    const { description, amount, category } = (req.body || {}) as { description?: string; amount?: number | string; category?: string };
    if (!description || amount === undefined) return res.status(400).json({ error: "Missing required fields: description, amount" });
    if (!auth.whatsappId) return res.status(409).json({ error: "WhatsApp identity not found for this account" });
    const expense = await prisma.expense.create({
      data: { whatsappId: auth.whatsappId, description, amount, category: category || null, createdAt: new Date() }
    });
    return res.status(201).json(serializers.expenseToApi(expense));
  } catch (error) {
    const message = getErrorMessage(error, "Failed to create expense");
    console.error("POST /api/expenses error:", error);
    return res.status(500).json({ error: message });
  }
});

async function deleteExpense(req: AuthenticatedRequest, res: express.Response) {
  try {
    const rawId = String(req.params.id || req.query.id || "");
    if (!/^\d+$/.test(rawId)) return res.status(400).json({ error: "Expense id must be a positive integer" });

    const id = BigInt(rawId);
    if (id <= 0n || id > 9_223_372_036_854_775_807n) {
      return res.status(400).json({ error: "Expense id must be a positive integer" });
    }

    const whatsappIds = await getWhatsAppIdsForUser(req.auth.userId, req.auth.phoneNumber);
    const result = await prisma.expense.deleteMany({
      where: { id, whatsappId: { in: whatsappIds } }
    });
    return res.json({ deleted: result.count > 0 });
  } catch (error) {
    const message = getErrorMessage(error, "Failed to delete expense");
    console.error("DELETE /api/expenses error:", error);
    return res.status(500).json({ error: message });
  }
}

router.delete("/", (req, res) => deleteExpense(req as unknown as AuthenticatedRequest, res));
router.delete("/:id", (req, res) => deleteExpense(req as unknown as AuthenticatedRequest, res));

export = router;
