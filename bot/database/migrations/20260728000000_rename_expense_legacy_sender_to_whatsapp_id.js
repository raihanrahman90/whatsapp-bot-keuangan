exports.up = async function (knex) {
  const hasExpensesTable = await knex.schema.hasTable("expenses");
  if (!hasExpensesTable) return;

  const hasLegacyColumn = await knex.schema.hasColumn("expenses", "legacy_sender_id");
  const hasWhatsAppColumn = await knex.schema.hasColumn("expenses", "whatsapp_id");

  if (hasLegacyColumn && !hasWhatsAppColumn) {
    await knex.schema.alterTable("expenses", (table) => {
      table.renameColumn("legacy_sender_id", "whatsapp_id");
    });
  }
};

exports.down = async function (knex) {
  const hasExpensesTable = await knex.schema.hasTable("expenses");
  if (!hasExpensesTable) return;

  const hasLegacyColumn = await knex.schema.hasColumn("expenses", "legacy_sender_id");
  const hasWhatsAppColumn = await knex.schema.hasColumn("expenses", "whatsapp_id");

  if (hasWhatsAppColumn && !hasLegacyColumn) {
    await knex.schema.alterTable("expenses", (table) => {
      table.renameColumn("whatsapp_id", "legacy_sender_id");
    });
  }
};
