import type { Request } from "express";

export interface AuthenticatedRequest extends Request {
  auth: {
    phoneNumber: string;
    userId: bigint;
    whatsappId?: string;
  };
}

export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
