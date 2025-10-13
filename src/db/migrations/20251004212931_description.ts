import type { Knex } from "knex";


exports.up = function(knex: Knex) {
  return knex.schema.alterTable('products', function(table) {
    table.text('description').nullable();
  });
};

exports.down = function(knex: Knex) {
  return knex.schema.alterTable('products', function(table) {
    table.dropColumn('description');
  });
};
