import type { Knex } from "knex";
// in src/db/migrations/YYYYMMDDHHMMSS_create_receipts_table.js
exports.up = function(knex: Knex) {
  return knex.schema.createTable('receipts', function(table) {
    table.string('id').primary();
    table.decimal('subtotal', 8, 2).notNullable();
    table.decimal('tax', 8, 2).notNullable();
    table.decimal('total', 8, 2).notNullable();
    table.string('payment_method').notNullable();
    // This could optionally link to a session
    table.string('session_id').references('id').inTable('sessions').onDelete('SET NULL').nullable();
    table.timestamps(true, true);
  });
};

exports.down = function(knex: Knex) {
  return knex.schema.dropTableIfExists('receipts');
};