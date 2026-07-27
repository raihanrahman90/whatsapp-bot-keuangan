exports.up = async function (knex) {
  await knex.raw("ALTER TABLE users ALTER COLUMN phone_number DROP NOT NULL");

  await knex.schema.createTable("whatsapp_identities", (table) => {
    table.bigIncrements("id");
    table
      .bigInteger("user_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");
    table.string("whatsapp_id", 100).notNullable().unique();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("last_seen_at").notNullable().defaultTo(knex.fn.now());
    table.index("user_id");
  });

  for (const tableName of ["expenses", "todos"]) {
    await knex.schema.alterTable(tableName, (table) => {
      table.renameColumn("user_id", "legacy_sender_id");
    });
    await knex.schema.alterTable(tableName, (table) => {
      table
        .bigInteger("user_id")
        .references("id")
        .inTable("users")
        .onDelete("RESTRICT");
      table.index("user_id");
    });
  }
};

exports.down = async function (knex) {
  for (const tableName of ["expenses", "todos"]) {
    await knex.schema.alterTable(tableName, (table) => {
      table.dropForeign("user_id");
      table.dropIndex("user_id");
      table.dropColumn("user_id");
      table.renameColumn("legacy_sender_id", "user_id");
    });
  }
  await knex.schema.dropTableIfExists("whatsapp_identities");
  await knex.raw("ALTER TABLE users ALTER COLUMN phone_number SET NOT NULL");
};
