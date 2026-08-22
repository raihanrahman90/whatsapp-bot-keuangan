/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable("notes", (table) => {
    table.bigIncrements("id");
    table.string("name", 255).notNullable();
    table.text("fact").notNullable();
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.index("name");
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTable("notes");
};
