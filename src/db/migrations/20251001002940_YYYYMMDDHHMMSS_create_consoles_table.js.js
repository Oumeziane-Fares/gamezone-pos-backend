exports.up = function(knex) {
  return knex.schema.createTable('consoles', function(table) {
    table.string('id').primary();
    table.string('name').notNullable();
    table.string('type').notNullable(); // 'PS4' or 'PS5'
    table.string('status').notNullable().defaultTo('available'); // available, in-use, maintenance
    table.decimal('hourly_rate', 8, 2).notNullable();
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('consoles');
};