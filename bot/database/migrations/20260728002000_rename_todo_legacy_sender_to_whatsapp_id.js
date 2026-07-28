exports.up = async function (knex) {
  const hasTodosTable = await knex.schema.hasTable("todos");
  if (!hasTodosTable) return;

  const hasLegacyColumn = await knex.schema.hasColumn("todos", "legacy_sender_id");
  const hasWhatsAppColumn = await knex.schema.hasColumn("todos", "whatsapp_id");
  if (!hasLegacyColumn || hasWhatsAppColumn) return;

  // Web-created todos previously left the sender blank. Use the linked user's
  // WhatsApp phone number before giving the column its final name.
  await knex.raw(`
    UPDATE todos AS todo
    SET legacy_sender_id = users.phone_number
    FROM users
    WHERE todo.user_id = users.id
      AND COALESCE(todo.legacy_sender_id, '') = ''
      AND users.phone_number IS NOT NULL
  `);

  await knex.schema.alterTable("todos", (table) => {
    table.renameColumn("legacy_sender_id", "whatsapp_id");
  });
};

exports.down = async function (knex) {
  const hasTodosTable = await knex.schema.hasTable("todos");
  if (!hasTodosTable) return;

  const hasLegacyColumn = await knex.schema.hasColumn("todos", "legacy_sender_id");
  const hasWhatsAppColumn = await knex.schema.hasColumn("todos", "whatsapp_id");
  if (hasWhatsAppColumn && !hasLegacyColumn) {
    await knex.schema.alterTable("todos", (table) => {
      table.renameColumn("whatsapp_id", "legacy_sender_id");
    });
  }
};
