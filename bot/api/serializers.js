function toJsonValue(value) {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(toJsonValue);
  if (value && typeof value.toJSON === "function") return toJsonValue(value.toJSON());
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toJsonValue(item)]));
  }
  return value;
}

function expenseToApi(expense) {
  return toJsonValue({
    id: expense.id,
    phone_number: expense.phoneNumber,
    amount: expense.amount,
    category: expense.category,
    description: expense.description,
    created_at: expense.createdAt
  });
}

function todoToApi(todo) {
  return toJsonValue({
    id: todo.id,
    code: todo.code,
    phone_number: todo.phoneNumber,
    user_id: todo.userId,
    text: todo.text,
    created_at: todo.createdAt
  });
}

module.exports = { expenseToApi, todoToApi };
