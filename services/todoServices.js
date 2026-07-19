const fs = require("fs");
const path = require("path");

const FILE_NAME = path.join(__dirname, "../todos.json");
const FILE_NAME = path.join(process.cwd(), "todos.json");

function loadTodos() {
  if (!fs.existsSync(FILE_NAME)) {
    return [];
  }

  return JSON.parse(fs.readFileSync(FILE_NAME, "utf8"));
}

function saveTodos(data) {
  fs.writeFileSync(FILE_NAME, JSON.stringify(data, null, 2));
}

function generateCode() {
  return Math.random()
    .toString(36)
    .substring(2, 6)
    .toUpperCase();
}

function saveTodo(userId, text) {
  const todos = loadTodos();

  let code;

  do {
    code = generateCode();
  } while (todos.find(x => x.code === code));

  const todo = {
    code,
    userId,
    text,
    createdAt: new Date().toISOString()
  };

  todos.push(todo);

  saveTodos(todos);

  return todo;
}

function removeTodo(userId, code) {
  const todos = loadTodos();

  const index = todos.findIndex(
    t =>
      t.userId === userId &&
      t.code === code.toUpperCase()
  );

  if (index === -1) {
    return false;
  }

  todos.splice(index, 1);

  saveTodos(todos);

  return true;
}

function getTodos(userId) {
  return loadTodos().filter(
    t => t.userId === userId
  );
}

module.exports = {
  saveTodo,
  removeTodo,
  getTodos
};