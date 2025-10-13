import type { Knex } from "knex";


exports.up = function(knex: Knex) {
  return knex.schema.alterTable('receipt_items', function(table) {
    table.string('product_name').nullable();
  });
};

exports.down = function(knex: Knex) {
  return knex.schema.alterTable('receipt_items', function(table) {
    table.dropColumn('product_name');
  });
};