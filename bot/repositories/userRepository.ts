import prisma = require("../config/prisma");

interface ResolveUserInput {
  remoteJid: string;
  remoteJidAlt?: string | null;
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
          await tx.expense.updateMany({ where: { userId }, data: { userId: phoneUser.id } });
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
