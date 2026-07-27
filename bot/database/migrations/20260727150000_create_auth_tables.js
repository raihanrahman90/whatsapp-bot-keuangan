/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.schema.createTable("users", (table) => {
    table.bigIncrements("id");
    table.string("phone_number", 15).notNullable().unique();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("last_authenticated_at");
  });

  await knex.schema.createTable("otp_challenges", (table) => {
    table.bigIncrements("id");
    table
      .string("phone_number", 15)
      .notNullable()
      .unique()
      .references("phone_number")
      .inTable("users")
      .onDelete("CASCADE");
    table.string("code_hash", 64).notNullable();
    table.timestamp("expires_at").notNullable();
    table.integer("attempts").notNullable().defaultTo(0);
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("otp_challenges");
  await knex.schema.dropTableIfExists("users");
};
