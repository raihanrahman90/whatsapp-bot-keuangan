import prisma = require("../config/prisma");

type UserId = bigint | number | string;

interface CreateTodoInput {
  code: string;
  userId?: UserId | null;
  whatsappId?: string | null;
  text: string;
  createdAt?: Date;
}

function toUserId(userId: UserId): bigint {
  return typeof userId === "bigint" ? userId : BigInt(userId);
}

export async function createTodo(data: CreateTodoInput) {
  return prisma.todo.create({
    data: {
      code: data.code,
      userId: data.userId == null ? null : toUserId(data.userId),
      whatsappId: data.whatsappId || "",
      text: data.text,
      createdAt: data.createdAt || new Date()
    }
  });
}

export async function deleteTodo(userId: UserId, code: string): Promise<number> {
  const result = await prisma.todo.deleteMany({ where: { userId: toUserId(userId), code } });
  return result.count;
}

export async function getTodos(userId: UserId) {
  return prisma.todo.findMany({
    where: { userId: toUserId(userId) },
    orderBy: { createdAt: "asc" }
  });
}

export async function getTodoByCode(code: string) {
  return prisma.todo.findUnique({ where: { code } });
}
