const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432", 10),
  database: process.env.DB_NAME || "finance_bot",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "password123",
});

module.exports = pool;
