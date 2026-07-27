const express = require("express");
const cors = require("cors");
const authRouter = require("./routes/auth");
const expensesRouter = require("./routes/expenses");
const todosRouter = require("./routes/todos");
const statsRouter = require("./routes/stats");
const { requireAuth } = require("./middleware/requireAuth");

function createApiServer() {
  const app = express();
  if (process.env.TRUST_PROXY && process.env.TRUST_PROXY !== "false") {
    app.set("trust proxy", process.env.TRUST_PROXY === "true" ? 1 : process.env.TRUST_PROXY);
  }
  app.use(cors({ origin: process.env.CORS_ORIGIN || "*", methods: ["GET", "POST", "DELETE", "PATCH"], credentials: true }));
  app.use(express.json());
  app.get("/health", (_req, res) => res.json({ status: "ok", service: "whatsapp-bot", timestamp: new Date().toISOString() }));
  app.use("/api/auth", authRouter);
  app.use("/api/expenses", requireAuth, expensesRouter);
  app.use("/api/todos", requireAuth, todosRouter);
  app.use("/api/stats", requireAuth, statsRouter);
  app.use((req, res) => res.status(404).json({ error: `Route ${req.method} ${req.path} not found` }));
  app.use((error, _req, res, _next) => {
    console.error("Unhandled API error:", error);
    res.status(500).json({ error: "Internal server error" });
  });
  return app;
}

module.exports = { createApiServer };
