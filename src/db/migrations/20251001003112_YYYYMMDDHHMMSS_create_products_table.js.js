exports.up = function(knex) {
  return knex.schema.createTable('products', function(table) {
    table.string('id').primary();
    table.string('name').notNullable();
    table.string('category').notNullable();
    table.decimal('price', 8, 2).notNullable();
    table.decimal('cost', 8, 2).notNullable();
    table.integer('stock').notNullable().defaultTo(0);
    table.integer('low_stock_threshold').notNullable().defaultTo(10);
    table.string('barcode').unique();
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('products');
};

