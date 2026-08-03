import type { ReceiptExtractionResult } from "./receiptExtractionService";

const DRAFT_KEY_PREFIX = "expense:draft:";
const RECEIPT_UPLOAD_KEY_PREFIX = "expense:receipt-upload:";
const DEFAULT_TTL_SECONDS = 15 * 60;
const APP_TIME_ZONE = "Asia/Makassar";

interface RedisDraftClient {
  connect(): Promise<unknown>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options: { EX: number; NX?: boolean }): Promise<unknown>;
  del(key: string): Promise<unknown>;
  on(event: "error", listener: (error: unknown) => void): unknown;
}

export interface ExpenseDraft {
  phoneNumber: string;
  receipt: ReceiptExtractionResult;
  createdAt: string;
}

let redisClientPromise: Promise<RedisDraftClient> | null = null;

export async function saveExpenseDraft(phoneNumber: string, receipt: ReceiptExtractionResult): Promise<ExpenseDraft> {
  const draft: ExpenseDraft = { phoneNumber, receipt, createdAt: new Date().toISOString() };
  await (await getRedisClient()).set(getDraftKey(phoneNumber), JSON.stringify(draft), { EX: getDraftTtlSeconds() });
  return draft;
}

export async function getExpenseDraft(phoneNumber: string): Promise<ExpenseDraft | null> {
  const rawDraft = await (await getRedisClient()).get(getDraftKey(phoneNumber));
  if (!rawDraft) return null;

  try {
    const draft = JSON.parse(rawDraft) as ExpenseDraft;
    if (!isExpenseDraft(draft) || draft.phoneNumber !== phoneNumber) throw new Error("Invalid expense draft");
    return draft;
  } catch {
    await deleteExpenseDraft(phoneNumber);
    return null;
  }
}

export async function deleteExpenseDraft(phoneNumber: string): Promise<void> {
  await (await getRedisClient()).del(getDraftKey(phoneNumber));
}

/** Returns false when this phone number has already uploaded a receipt today. */
export async function reserveReceiptUploadForToday(phoneNumber: string): Promise<boolean> {
  const result = await (await getRedisClient()).set(
    `${RECEIPT_UPLOAD_KEY_PREFIX}${getTodayKey()}:${encodeURIComponent(phoneNumber)}`,
    "1",
    { EX: getSecondsUntilTomorrow(), NX: true }
  );
  return result === "OK";
}

function getDraftKey(phoneNumber: string): string {
  return `${DRAFT_KEY_PREFIX}${encodeURIComponent(phoneNumber)}`;
}

function getDraftTtlSeconds(): number {
  const configuredTtl = Number(process.env.EXPENSE_DRAFT_TTL_SECONDS || DEFAULT_TTL_SECONDS);
  return Number.isSafeInteger(configuredTtl) && configuredTtl > 0 ? configuredTtl : DEFAULT_TTL_SECONDS;
}

function getTodayKey(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const valueFor = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${valueFor("year")}-${valueFor("month")}-${valueFor("day")}`;
}

function getSecondsUntilTomorrow(): number {
  const now = new Date();
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(now);
  const valueFor = (type: string) => Number(time.find((part) => part.type === type)?.value || 0);
  const secondsToday = valueFor("hour") * 3_600 + valueFor("minute") * 60 + valueFor("second");
  return Math.max(1, 24 * 3_600 - secondsToday);
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
    typeof value.phoneNumber === "string" &&
    typeof value.createdAt === "string" &&
    value.receipt &&
    Array.isArray(value.receipt.items) &&
    value.receipt.items.every((item) => item && typeof item.name === "string" && item.name.trim().length > 0 && Number.isFinite(item.price) && item.price > 0) &&
    (typeof value.receipt.amount === "number" || value.receipt.amount === null)
  );
}
