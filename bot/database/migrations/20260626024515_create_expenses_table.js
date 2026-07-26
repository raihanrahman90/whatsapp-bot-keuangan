exports.up = async function (knex) {
  await knex.schema.createTable('expenses', (table) => {
    table.bigIncrements('id');
    table.decimal('amount', 15, 2).notNullable();
    table.string('category', 100);
    table.text('description');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTable('expenses');
};