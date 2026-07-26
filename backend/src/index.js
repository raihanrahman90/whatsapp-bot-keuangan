const express = require("express");
const cors = require("cors");

const expensesRouter = require("./routes/expenses");
const todosRouter = require("./routes/todos");
const statsRouter = require("./routes/stats");

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST", "DELETE", "PATCH"],
  })
);
app.use(express.json());

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "whatsapp-bot-backend", timestamp: new Date().toISOString() });
});

// API routes
app.use("/api/expenses", expensesRouter);
app.use("/api/todos", todosRouter);
app.use("/api/stats", statsRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Backend API running on port ${PORT}`);
});
