const express = require("express");
const prisma = require("../../config/prisma");
const { expenseToApi } = require("../serializers");
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { month, year } = req.query;
    const expenses = await prisma.expense.findMany({
      where: { userId: req.auth.userId },
      orderBy: { createdAt: "desc" }
    });
    const filtered = expenses
      .filter((expense) => {
        if (!expense.createdAt) return !year && !month;
        return (!year || expense.createdAt.getFullYear() === Number(year)) &&
          (!month || expense.createdAt.getMonth() + 1 === Number(month));
      })
      .slice(0, 100);
    console.log("GET /api/expenses", {
      phoneNumber: req.auth.phoneNumber,
      userId: req.auth.userId.toString(),
      year: year || null,
      month: month || null,
      resultCount: filtered.length
    });
    return res.json(filtered.map(expenseToApi));
  } catch (error) {
    console.error("GET /api/expenses error:", error);
    return res.status(500).json({ error: error.message || "Failed to fetch expenses" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { description, amount, category } = req.body || {};
    if (!description || amount === undefined) return res.status(400).json({ error: "Missing required fields: description, amount" });
    const expense = await prisma.expense.create({
      data: { userId: req.auth.userId, description, amount, category: category || null, createdAt: new Date() }
    });
    return res.status(201).json(expenseToApi(expense));
  } catch (error) {
    console.error("POST /api/expenses error:", error);
    return res.status(500).json({ error: error.message || "Failed to create expense" });
  }
});

module.exports = router;
