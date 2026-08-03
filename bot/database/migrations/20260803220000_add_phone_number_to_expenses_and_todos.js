exports.up = async function (knex) {
  for (const tableName of ["expenses", "todos"]) {
    await knex.schema.alterTable(tableName, (table) => {
      table.string("phone_number", 15);
      table.index("phone_number");
    });
  }

  await knex.raw(`
    UPDATE expenses AS expense
    SET phone_number = users.phone_number
    FROM whatsapp_identities AS identity
    JOIN users ON users.id = identity.user_id
    WHERE expense.whatsapp_id = identity.whatsapp_id
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
    WHERE todo.user_id = users.id
      AND users.phone_number IS NOT NULL
  `);
};

exports.down = async function (knex) {
  for (const tableName of ["expenses", "todos"]) {
    await knex.schema.alterTable(tableName, (table) => {
      table.dropIndex("phone_number");
      table.dropColumn("phone_number");
    });
  }
};
