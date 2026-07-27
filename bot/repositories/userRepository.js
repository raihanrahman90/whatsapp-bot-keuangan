const db = require("../config/database");

function getPhoneNumberFromJids(remoteJid, remoteJidAlt) {
  const phoneJid = [remoteJid, remoteJidAlt].find((jid) =>
    String(jid || "").endsWith("@s.whatsapp.net")
  );
  return phoneJid ? phoneJid.split("@")[0] : null;
}

async function resolveUserId({ remoteJid, remoteJidAlt }) {
  if (!remoteJid) throw new Error("Missing WhatsApp sender JID");

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const phoneNumber = getPhoneNumberFromJids(remoteJid, remoteJidAlt);
    const knownIdentity = await client.query(
      "SELECT user_id FROM whatsapp_identities WHERE whatsapp_jid = $1 FOR UPDATE",
      [remoteJid]
    );
    if (knownIdentity.rowCount) {
      let userId = knownIdentity.rows[0].user_id;
      if (phoneNumber) {
        const phoneUser = await client.query(
          "SELECT id FROM users WHERE phone_number = $1 FOR UPDATE",
          [phoneNumber]
        );
        if (phoneUser.rowCount && phoneUser.rows[0].id !== userId) {
          const targetUserId = phoneUser.rows[0].id;
          await client.query(
            "UPDATE whatsapp_identities SET user_id = $1 WHERE user_id = $2",
            [targetUserId, userId]
          );
          await client.query("UPDATE expenses SET user_id = $1 WHERE user_id = $2", [
            targetUserId,
            userId
          ]);
          await client.query("UPDATE todos SET user_id = $1 WHERE user_id = $2", [
            targetUserId,
            userId
          ]);
          await client.query("DELETE FROM users WHERE id = $1", [userId]);
          userId = targetUserId;
        } else if (!phoneUser.rowCount) {
          await client.query("UPDATE users SET phone_number = $1 WHERE id = $2", [
            phoneNumber,
            userId
          ]);
        }
      }
      await client.query(
        "UPDATE whatsapp_identities SET last_seen_at = NOW() WHERE whatsapp_jid = $1",
        [remoteJid]
      );
      await client.query("COMMIT");
      return userId;
    }

    let userId;
    if (phoneNumber) {
      const existingUser = await client.query(
        "SELECT id FROM users WHERE phone_number = $1 FOR UPDATE",
        [phoneNumber]
      );
      if (existingUser.rowCount) {
        userId = existingUser.rows[0].id;
      } else {
        const createdUser = await client.query(
          "INSERT INTO users (phone_number) VALUES ($1) RETURNING id",
          [phoneNumber]
        );
        userId = createdUser.rows[0].id;
      }
    } else {
      const createdUser = await client.query(
        "INSERT INTO users (phone_number) VALUES (NULL) RETURNING id"
      );
      userId = createdUser.rows[0].id;
    }

    await client.query(
      "INSERT INTO whatsapp_identities (user_id, whatsapp_jid) VALUES ($1, $2)",
      [userId, remoteJid]
    );
    await client.query("COMMIT");
    return userId;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { resolveUserId };
