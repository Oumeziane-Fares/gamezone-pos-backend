import type { Knex } from "knex";


// in src/db/migrations/YYYYMMDDHHMMSS_create_receipt_items_table.js
exports.up = function(knex: Knex) {
  return knex.schema.createTable('receipt_items', function(table) {
    table.increments('id').primary();
    table.string('receipt_id').references('id').inTable('receipts').onDelete('CASCADE');
    table.string('product_id').references('id').inTable('products').onDelete('SET NULL');
    table.integer('quantity').notNullable();
    table.decimal('unit_price', 8, 2).notNullable(); // Price at time of sale
    table.decimal('subtotal', 8, 2).notNullable();
  });
};

exports.down = function(knex: Knex) {
  return knex.schema.dropTableIfExists('receipt_items');
};