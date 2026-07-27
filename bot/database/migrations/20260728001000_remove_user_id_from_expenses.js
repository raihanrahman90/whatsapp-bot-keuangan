exports.up = async function (knex) {
  const hasExpensesTable = await knex.schema.hasTable("expenses");
  if (!hasExpensesTable || !(await knex.schema.hasColumn("expenses", "user_id"))) return;

  // Expenses created from the dashboard before this migration did not have a
  // WhatsApp ID. Preserve their ownership using the authenticated phone number.
  await knex.raw(`
    UPDATE expenses AS expense
    SET whatsapp_id = users.phone_number
    FROM users
    WHERE expense.user_id = users.id
      AND COALESCE(expense.whatsapp_id, '') = ''
      AND users.phone_number IS NOT NULL
  `);

  await knex.schema.alterTable("expenses", (table) => {
    table.dropForeign("user_id");
    table.dropIndex("user_id");
    table.dropColumn("user_id");
    table.index("whatsapp_id");
  });
};

exports.down = async function (knex) {
  const hasExpensesTable = await knex.schema.hasTable("expenses");
  if (!hasExpensesTable || (await knex.schema.hasColumn("expenses", "user_id"))) return;

  await knex.schema.alterTable("expenses", (table) => {
    table
      .bigInteger("user_id")
      .references("id")
      .inTable("users")
      .onDelete("RESTRICT");
    table.index("user_id");
    table.dropIndex("whatsapp_id");
  });
};
