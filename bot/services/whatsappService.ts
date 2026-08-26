import { gowaClient } from "./gowaService";
import { sendOtp } from "./otpDeliveryService";
export async function deliverOtp(phoneNumber: unknown, code: unknown, expiresInMinutes: number): Promise<void> { await sendOtp(gowaClient, phoneNumber, code, expiresInMinutes); }
