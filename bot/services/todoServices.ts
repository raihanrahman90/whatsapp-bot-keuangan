import * as fs from "node:fs";
import * as path from "node:path";
import { createTodo, deleteTodo, getTodoByCode, getTodos as findTodos } from "../repositories/todoRepository";

export interface TodoSummary {
  code: string;
  userId: bigint | null;
  text: string;
  createdAt: Date | null;
}

interface LegacyTodo {
  code?: string;
  userId?: bigint | number | string;
  text?: string;
  createdAt?: string;
}

function getFilePath(filename: string): string {
  const dataPath = path.join(process.cwd(), "data", filename);
  if (fs.existsSync(dataPath)) return dataPath;
  const rootPath = path.join(process.cwd(), filename);
  return fs.existsSync(rootPath) ? rootPath : dataPath;
}

function mapRowToTodo(row: Awaited<ReturnType<typeof createTodo>>): TodoSummary {
  return { code: row.code, userId: row.userId, text: row.text, createdAt: row.createdAt };
}

function generateCode(): string {
  return Math.random().toString(36).substring(2, 4).toUpperCase();
}

export async function saveTodo(userId: bigint, phoneNumber: string, text: string): Promise<TodoSummary> {
  let code = generateCode();
  while (await getTodoByCode(code)) code = generateCode();
  return mapRowToTodo(await createTodo({ code, userId, phoneNumber, text, createdAt: new Date() }));
}

export async function removeTodo(userId: bigint, code: string): Promise<boolean> {
  return (await deleteTodo(userId, code.toUpperCase())) > 0;
}

export async function getTodos(userId: bigint): Promise<TodoSummary[]> {
  return (await findTodos(userId)).map(mapRowToTodo);
}

export async function migrateJsonToDb(): Promise<void> {
  const targetFile = getFilePath("todos.json");
  if (!fs.existsSync(targetFile)) {
    console.log("todos.json not found, skipping migration");
    return;
  }

  try {
    const todos = JSON.parse(fs.readFileSync(targetFile, "utf8")) as LegacyTodo[];
    if (Array.isArray(todos) && todos.length > 0) {
      console.log(`[Migration] Found ${todos.length} todos in ${path.basename(targetFile)}. Migrating to database...`);
      for (const todo of todos) {
        if (!todo.code || todo.userId == null || !todo.text || await getTodoByCode(todo.code)) continue;
        const user = await prisma.user.findUnique({ where: { id: BigInt(todo.userId) }, select: { phoneNumber: true } });
        if (!user?.phoneNumber) continue;
        await createTodo({ code: todo.code, userId: todo.userId, phoneNumber: user.phoneNumber, text: todo.text, createdAt: todo.createdAt ? new Date(todo.createdAt) : new Date() });
      }
      console.log(`[Migration] Successfully migrated ${todos.length} todos to database.`);
    }
    fs.renameSync(targetFile, `${targetFile}.bak`);
  } catch (error) {
    console.error("[Migration] Failed to migrate todos.json:", error);
  }
}
