exports.up = function(knex) {
  return knex.schema.createTable('session_items', function(table) {
    table.increments('id').primary();
    table.string('session_id').references('id').inTable('sessions').onDelete('CASCADE');
    table.string('product_id').references('id').inTable('products').onDelete('SET NULL');
    table.integer('quantity').notNullable();
    table.decimal('unit_price', 8, 2).notNullable(); // Price at time of sale
    table.decimal('subtotal', 8, 2).notNullable();
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('session_items');
};