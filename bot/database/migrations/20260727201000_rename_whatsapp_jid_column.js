exports.up = async function (knex) {
  const hasIdentityTable = await knex.schema.hasTable("whatsapp_identities");
  if (!hasIdentityTable) return;

  const hasOldColumn = await knex.schema.hasColumn(
    "whatsapp_identities",
    "whatsapp_jid"
  );
  const hasNewColumn = await knex.schema.hasColumn(
    "whatsapp_identities",
    "whatsapp_id"
  );

  if (hasOldColumn && !hasNewColumn) {
    await knex.schema.alterTable("whatsapp_identities", (table) => {
      table.renameColumn("whatsapp_jid", "whatsapp_id");
    });
  }
};

exports.down = async function (knex) {
  const hasOldColumn = await knex.schema.hasColumn(
    "whatsapp_identities",
    "whatsapp_jid"
  );
  const hasNewColumn = await knex.schema.hasColumn(
    "whatsapp_identities",
    "whatsapp_id"
  );

  if (hasNewColumn && !hasOldColumn) {
    await knex.schema.alterTable("whatsapp_identities", (table) => {
      table.renameColumn("whatsapp_id", "whatsapp_jid");
    });
  }
};
