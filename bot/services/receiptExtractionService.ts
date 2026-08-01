const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-5.6-luna";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export interface ReceiptExtractionInput {
  image: Buffer;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
}

export interface ReceiptExtractionResult {
  merchant: string | null;
  receiptDate: string | null;
  items: ReceiptItem[];
  amount: number | null;
  currency: string;
  category: string | null;
  confidence: number;
  warnings: string[];
}

export interface ReceiptItem {
  name: string;
  price: number;
}

interface OpenAIResponsePayload {
  output_text?: string;
  output?: Array<{
    content?: Array<{ type?: string; text?: string }>;
  }>;
  error?: { message?: string };
}

const receiptSchema = {
  type: "object",
  additionalProperties: false,
  required: ["merchant", "receiptDate", "items", "amount", "currency", "category", "confidence", "warnings"],
  properties: {
    merchant: { type: ["string", "null"] },
    receiptDate: {
      type: ["string", "null"],
      description: "Tanggal pada struk dalam format YYYY-MM-DD, atau null bila tidak terbaca."
    },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "price"],
        properties: {
          name: { type: "string", description: "Nama satu barang atau layanan pada struk." },
          price: { type: "number", minimum: 0.01, description: "Harga satuan barang atau layanan dalam Rupiah." }
        }
      }
    },
    amount: {
      type: ["number", "null"],
      description: "Total pembayaran akhir dalam Rupiah tanpa pemisah ribuan, atau null bila tidak terbaca."
    },
    currency: { type: "string" },
    category: { type: ["string", "null"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    warnings: { type: "array", items: { type: "string" } }
  }
} as const;

/**
 * Membaca satu foto struk dan mengubahnya menjadi data expense terstruktur.
 * Hasilnya masih berupa draft; pemanggil wajib meminta konfirmasi pengguna
 * sebelum menyimpan expense ke database.
 */
export async function extractReceipt(input: ReceiptExtractionInput): Promise<ReceiptExtractionResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY must be configured");
  if (input.image.length === 0) throw new Error("Receipt image is empty");
  if (input.image.length > MAX_IMAGE_BYTES) throw new Error("Receipt image exceeds the 10 MB limit");

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_RECEIPT_MODEL || DEFAULT_MODEL,
      store: false,
      reasoning: { effort: "low" },
      input: [{
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              "Ekstrak data pengeluaran dari foto struk ini.",
              "Gunakan hanya informasi yang tampak pada struk; jangan menebak.",
              "amount adalah total akhir yang benar-benar dibayar, dalam Rupiah tanpa pemisah ribuan.",
              "receiptDate harus YYYY-MM-DD atau null. Beri confidence 0 sampai 1 dan warning untuk data yang meragukan.",
              "items harus berisi semua barang atau layanan yang terbaca. Setiap elemen wajib memiliki name dan price dalam Rupiah, dengan price sebagai harga satuan, bukan total struk atau subtotal. Jika struk menunjukkan kuantitas lebih dari satu, buat satu elemen untuk setiap unit agar setiap harga yang disimpan adalah harga satuan. Jangan gabungkan beberapa item menjadi satu teks, dan jangan memakai awalan umum seperti Pembelian, Belanja, atau Transaksi."
            ].join(" ")
          },
          {
            type: "input_image",
            image_url: `data:${input.mimeType};base64,${input.image.toString("base64")}`,
            detail: "high"
          }
        ]
      }],
      text: {
        format: {
          type: "json_schema",
          name: "receipt_expense",
          strict: true,
          schema: receiptSchema
        }
      }
    })
  });

  const payload = await response.json() as OpenAIResponsePayload;
  if (!response.ok) {
    throw new Error(`OpenAI receipt extraction failed (${response.status}): ${payload.error?.message || "Unknown error"}`);
  }

  const outputText = getOutputText(payload);
  if (!outputText) throw new Error("OpenAI receipt extraction returned no structured output");

  let result: ReceiptExtractionResult;
  try {
    result = JSON.parse(outputText) as ReceiptExtractionResult;
  } catch {
    throw new Error("OpenAI receipt extraction returned invalid JSON");
  }

  result.items = normalizeItems(result.items);
  validateResult(result);
  return result;
}

function normalizeItems(items: ReceiptItem[]): ReceiptItem[] {
  return items
    .filter((item): item is ReceiptItem => Boolean(item && typeof item === "object"))
    .map((item) => ({
      name: typeof item.name === "string"
        ? item.name.replace(/^\s*(?:pembelian|belanja|transaksi)\s*[:\-]?\s*/i, "").trim()
        : "",
      price: item.price
    }))
    .filter((item) => Boolean(item.name));
}

function getOutputText(payload: OpenAIResponsePayload): string | undefined {
  if (payload.output_text?.trim()) return payload.output_text;
  return payload.output
    ?.flatMap((item) => item.content || [])
    .find((item) => item.type === "output_text" && item.text?.trim())
    ?.text;
}

function validateResult(result: ReceiptExtractionResult): void {
  if (!result || typeof result !== "object") throw new Error("OpenAI receipt extraction returned an invalid result");
  if (!Array.isArray(result.items) || result.items.length === 0 || !result.items.every(
    (item) => item && typeof item.name === "string" && item.name.trim() && Number.isFinite(item.price) && item.price > 0
  )) {
    throw new Error("OpenAI receipt extraction returned no items");
  }
  if (result.amount !== null && (!Number.isFinite(result.amount) || result.amount <= 0)) {
    throw new Error("OpenAI receipt extraction returned an invalid amount");
  }
  if (typeof result.confidence !== "number" || result.confidence < 0 || result.confidence > 1) {
    throw new Error("OpenAI receipt extraction returned an invalid confidence score");
  }
  if (!Array.isArray(result.warnings) || !result.warnings.every((warning) => typeof warning === "string")) {
    throw new Error("OpenAI receipt extraction returned invalid warnings");
  }
}
