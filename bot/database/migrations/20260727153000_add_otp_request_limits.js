/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.schema.createTable("otp_request_attempts", (table) => {
    table.bigIncrements("id");
    table.string("phone_number", 15).notNullable();
    table.string("ip_address", 45);
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.index(["phone_number", "created_at"]);
    table.index(["ip_address", "created_at"]);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("otp_request_attempts");
};
