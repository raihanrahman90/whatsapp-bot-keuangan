const fs = require("fs");
const path = require("path");
const todoRepository = require("../repositories/todoRepository");

const FILE_NAME = path.join(process.cwd(), "todos.json");

function mapRowToTodo(row) {
  if (!row) return null;
  return {
    code: row.code,
    userId: row.user_id,
    text: row.text,
    createdAt: row.created_at
  };
}

function generateCode() {
  return Math.random()
    .toString(36)
    .substring(2, 4)
    .toUpperCase();
}

async function saveTodo(userId, text) {
  let code;
  let exists = true;

  while (exists) {
    code = generateCode();
    const existing = await todoRepository.getTodoByCode(code);
    if (!existing) {
      exists = false;
    }
  }

  const newTodo = await todoRepository.createTodo({
    code,
    userId,
    text,
    createdAt: new Date()
  });

  return mapRowToTodo(newTodo);
}

async function removeTodo(userId, code) {
  const deletedCount = await todoRepository.deleteTodo(userId, code.toUpperCase());
  return deletedCount > 0;
}

async function getTodos(userId) {
  const rows = await todoRepository.getTodos(userId);
  return rows.map(mapRowToTodo);
}

async function migrateJsonToDb() {
  if (!fs.existsSync(FILE_NAME)) {
    console.log("todos.json not found, skipping migration")
    return;
  }

  try {
    const data = fs.readFileSync(FILE_NAME, "utf8");
    const todos = JSON.parse(data);

    if (Array.isArray(todos) && todos.length > 0) {
      console.log(`[Migration] Found ${todos.length} todos in todos.json. Migrating to database...`);
      for (const todo of todos) {
        const existing = await todoRepository.getTodoByCode(todo.code);
        if (!existing) {
          await todoRepository.createTodo({
            code: todo.code,
            userId: todo.userId,
            text: todo.text,
            createdAt: todo.createdAt ? new Date(todo.createdAt) : new Date()
          });
        }
      }
      console.log(`[Migration] Successfully migrated todos to database.`);
    }

    const backupName = FILE_NAME + ".bak";
    fs.renameSync(FILE_NAME, backupName);
    console.log(`[Migration] Renamed todos.json to todos.json.bak`);
  } catch (err) {
    console.error("[Migration] Failed to migrate todos.json:", err);
  }
}

module.exports = {
  saveTodo,
  removeTodo,
  getTodos,
  migrateJsonToDb
};