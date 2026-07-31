import type { ReceiptExtractionResult } from "./receiptExtractionService";

const DRAFT_KEY_PREFIX = "expense:draft:";
const DEFAULT_TTL_SECONDS = 15 * 60;

interface RedisDraftClient {
  connect(): Promise<unknown>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options: { EX: number }): Promise<unknown>;
  del(key: string): Promise<unknown>;
  on(event: "error", listener: (error: unknown) => void): unknown;
}

export interface ExpenseDraft {
  whatsappId: string;
  receipt: ReceiptExtractionResult;
  createdAt: string;
}

let redisClientPromise: Promise<RedisDraftClient> | null = null;

export async function saveExpenseDraft(whatsappId: string, receipt: ReceiptExtractionResult): Promise<ExpenseDraft> {
  const draft: ExpenseDraft = { whatsappId, receipt, createdAt: new Date().toISOString() };
  await (await getRedisClient()).set(getDraftKey(whatsappId), JSON.stringify(draft), { EX: getDraftTtlSeconds() });
  return draft;
}

export async function getExpenseDraft(whatsappId: string): Promise<ExpenseDraft | null> {
  const rawDraft = await (await getRedisClient()).get(getDraftKey(whatsappId));
  if (!rawDraft) return null;

  try {
    const draft = JSON.parse(rawDraft) as ExpenseDraft;
    if (!isExpenseDraft(draft) || draft.whatsappId !== whatsappId) throw new Error("Invalid expense draft");
    return draft;
  } catch {
    await deleteExpenseDraft(whatsappId);
    return null;
  }
}

export async function deleteExpenseDraft(whatsappId: string): Promise<void> {
  await (await getRedisClient()).del(getDraftKey(whatsappId));
}

function getDraftKey(whatsappId: string): string {
  return `${DRAFT_KEY_PREFIX}${encodeURIComponent(whatsappId)}`;
}

function getDraftTtlSeconds(): number {
  const configuredTtl = Number(process.env.EXPENSE_DRAFT_TTL_SECONDS || DEFAULT_TTL_SECONDS);
  return Number.isSafeInteger(configuredTtl) && configuredTtl > 0 ? configuredTtl : DEFAULT_TTL_SECONDS;
}

async function getRedisClient(): Promise<RedisDraftClient> {
  if (!redisClientPromise) {
    redisClientPromise = createRedisClient().catch((error: unknown) => {
      redisClientPromise = null;
      throw error;
    });
  }
  return redisClientPromise;
}

async function createRedisClient(): Promise<RedisDraftClient> {
  const { createClient } = await import("redis");
  const client = createClient({ url: process.env.REDIS_URL || "redis://localhost:6379" });
  client.on("error", (error) => console.error("Redis client error:", error));
  await client.connect();
  return client;
}

function isExpenseDraft(value: ExpenseDraft): boolean {
  return Boolean(
    value &&
    typeof value.whatsappId === "string" &&
    typeof value.createdAt === "string" &&
    value.receipt &&
    typeof value.receipt.description === "string" &&
    (typeof value.receipt.amount === "number" || value.receipt.amount === null)
  );
}
