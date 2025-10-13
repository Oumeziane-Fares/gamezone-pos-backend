exports.up = function(knex) {
  return knex.schema.createTable('sessions', function(table) {
    table.string('id').primary();
    table.string('console_id').references('id').inTable('consoles').onDelete('SET NULL');
    table.datetime('start_time').notNullable();
    table.datetime('end_time');
    table.string('status').notNullable().defaultTo('active'); // active, paused, ended
    table.integer('total_paused_duration').defaultTo(0); // in milliseconds
    table.decimal('final_cost', 8, 2);
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('sessions');
};