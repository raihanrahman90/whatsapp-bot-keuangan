import prisma = require("../config/prisma");

interface ResolveUserInput {
  remoteJid: string;
  remoteJidAlt?: string | null;
}

export async function hasActiveSubscription(userId: bigint): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscription: true }
  });
  return user?.subscription === true;
}

export async function getPhoneNumberForUser(userId: bigint): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { phoneNumber: true }
  });
  return user?.phoneNumber || null;
}

function getPhoneNumberFromJids(remoteJid: string, remoteJidAlt?: string | null): string | null {
  const phoneJid = [remoteJid, remoteJidAlt].find((jid) =>
    String(jid || "").endsWith("@s.whatsapp.net")
  );
  const phoneNumber = phoneJid?.split("@")[0] || "";
  return /^\d{8,15}$/.test(phoneNumber) ? phoneNumber : null;
}

export async function resolveUserId({ remoteJid, remoteJidAlt }: ResolveUserInput): Promise<bigint> {
  if (!remoteJid) throw new Error("Missing WhatsApp sender JID");

  const phoneNumber = getPhoneNumberFromJids(remoteJid, remoteJidAlt);
  if (!phoneNumber) throw new Error("Missing WhatsApp sender phone number");

  const user = await prisma.user.upsert({
    where: { phoneNumber },
    update: {},
    create: { phoneNumber }
  });
  return user.id;
}
