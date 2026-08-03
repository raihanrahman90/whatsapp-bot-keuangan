import prisma = require("../config/prisma");

interface ResolveUserInput {
  remoteJid: string;
  remoteJidAlt?: string | null;
}

export async function getWhatsAppIdsForUser(userId: bigint, phoneNumber: string): Promise<string[]> {
  const identities = await prisma.whatsAppIdentity.findMany({
    where: { userId },
    select: { whatsappId: true }
  });
  return [...new Set([phoneNumber, ...identities.map((identity) => identity.whatsappId)])];
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
  return phoneJid ? phoneJid.split("@")[0] : null;
}

function getWhatsAppId(jid: string): string {
  return jid.split("@")[0];
}

export async function resolveUserId({ remoteJid, remoteJidAlt }: ResolveUserInput): Promise<bigint> {
  if (!remoteJid) throw new Error("Missing WhatsApp sender JID");

  const whatsappId = getWhatsAppId(remoteJid);
  const phoneNumber = getPhoneNumberFromJids(remoteJid, remoteJidAlt);

  return prisma.$transaction(async (tx) => {
    const knownIdentity = await tx.whatsAppIdentity.findUnique({ where: { whatsappId } });

    if (knownIdentity) {
      let userId = knownIdentity.userId;

      if (phoneNumber) {
        const phoneUser = await tx.user.findUnique({ where: { phoneNumber } });
        if (phoneUser && phoneUser.id !== userId) {
          await tx.whatsAppIdentity.updateMany({ where: { userId }, data: { userId: phoneUser.id } });
          await tx.todo.updateMany({ where: { userId }, data: { userId: phoneUser.id } });
          await tx.user.delete({ where: { id: userId } });
          userId = phoneUser.id;
        } else if (!phoneUser) {
          await tx.user.update({ where: { id: userId }, data: { phoneNumber } });
        }
      }

      await tx.whatsAppIdentity.update({ where: { whatsappId }, data: { lastSeenAt: new Date() } });
      return userId;
    }

    const user = phoneNumber
      ? await tx.user.upsert({ where: { phoneNumber }, update: {}, create: { phoneNumber } })
      : await tx.user.create({ data: {} });

    await tx.whatsAppIdentity.create({ data: { userId: user.id, whatsappId } });
    return user.id;
  }, { isolationLevel: "Serializable" });
}
