exports.up = async function (knex) {
  // Make one final attempt to preserve ownership before dropping the legacy
  // identity column. Rows without a resolvable phone number remain null.
  await knex.raw(`
    UPDATE expenses AS expense
    SET phone_number = users.phone_number
    FROM whatsapp_identities AS identity
    JOIN users ON users.id = identity.user_id
    WHERE expense.phone_number IS NULL
      AND expense.whatsapp_id = identity.whatsapp_id
      AND users.phone_number IS NOT NULL
  `);
  await knex.raw(`
    UPDATE expenses
    SET phone_number = whatsapp_id
    WHERE phone_number IS NULL
      AND whatsapp_id ~ '^[0-9]{8,15}$'
  `);
  await knex.raw(`
    UPDATE todos AS todo
    SET phone_number = users.phone_number
    FROM users
    WHERE todo.phone_number IS NULL
      AND todo.user_id = users.id
      AND users.phone_number IS NOT NULL
  `);

  await knex.schema.alterTable("expenses", (table) => {
    table.dropIndex("whatsapp_id");
    table.dropColumn("whatsapp_id");
  });
  await knex.schema.alterTable("todos", (table) => {
    table.dropColumn("whatsapp_id");
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("expenses", (table) => {
    table.string("whatsapp_id", 100).notNullable().defaultTo("");
    table.index("whatsapp_id");
  });
  await knex.schema.alterTable("todos", (table) => {
    table.string("whatsapp_id", 100).notNullable().defaultTo("");
  });

  for (const tableName of ["expenses", "todos"]) {
    await knex(tableName).whereNotNull("phone_number").update({ whatsapp_id: knex.ref("phone_number") });
  }
};
