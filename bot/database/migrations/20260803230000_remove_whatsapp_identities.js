exports.up = async function (knex) {
  await knex.schema.dropTableIfExists("whatsapp_identities");
};

exports.down = async function (knex) {
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

  await knex.raw(`
    INSERT INTO whatsapp_identities (user_id, whatsapp_id)
    SELECT id, phone_number
    FROM users
    WHERE phone_number IS NOT NULL
  `);
};
