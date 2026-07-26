/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('todos', (table) => {
    table.bigIncrements('id');
    table.string('code', 10).notNullable().unique();
    table.string('user_id', 100).notNullable();
    table.text('text').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('todos');
};
