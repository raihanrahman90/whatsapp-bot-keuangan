const db = require('../config/database');

async function createExpense(data) {
  const query = `
    INSERT INTO expenses
    (amount, category, description, user_id, legacy_sender_id, created_at)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;
  `;

  const result = await db.query(query, [
    data.amount,
    data.category || null,
    data.description,
    data.userId,
    data.legacySenderId || null,
    data.createdAt || new Date(),
  ]);

  return result.rows[0];
}

async function getExpensesForMonth(userId, year, month) {
  const query = `
    SELECT * FROM expenses
    WHERE user_id = $1
      AND EXTRACT(YEAR FROM created_at) = $2
      AND EXTRACT(MONTH FROM created_at) = $3
    ORDER BY created_at ASC;
  `;

  const result = await db.query(query, [userId, year, month]);
  return result.rows;
}

module.exports = {
  createExpense,
  getExpensesForMonth,
};
