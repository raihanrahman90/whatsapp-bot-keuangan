const db = require('../config/database');

async function createExpense(data) {
  const query = `
    INSERT INTO expenses
    (amount, category, description)
    VALUES ($1, $2, $3)
    RETURNING *;
  `;

  const result = await db.query(query, [
    data.amount,
    data.category,
    data.description,
  ]);

  return result.rows[0];
}

module.exports = {
  createExpense,
};