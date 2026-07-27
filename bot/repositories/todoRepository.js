const db = require('../config/database');

async function createTodo(data) {
  const query = `
    INSERT INTO todos
    (code, user_id, legacy_sender_id, text, created_at)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *;
  `;

  const result = await db.query(query, [
    data.code,
    data.userId,
    data.legacySenderId || null,
    data.text,
    data.createdAt || new Date(),
  ]);

  return result.rows[0];
}

async function deleteTodo(userId, code) {
  const query = `
    DELETE FROM todos
    WHERE user_id = $1 AND code = $2;
  `;

  const result = await db.query(query, [userId, code]);
  return result.rowCount;
}

async function getTodos(userId) {
  const query = `
    SELECT * FROM todos
    WHERE user_id = $1
    ORDER BY created_at ASC;
  `;

  const result = await db.query(query, [userId]);
  return result.rows;
}

async function getTodoByCode(code) {
  const query = `
    SELECT * FROM todos
    WHERE code = $1;
  `;

  const result = await db.query(query, [code]);
  return result.rows[0];
}

module.exports = {
  createTodo,
  deleteTodo,
  getTodos,
  getTodoByCode,
};
