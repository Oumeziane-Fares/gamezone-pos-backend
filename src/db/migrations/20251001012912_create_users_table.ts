import type { Knex } from "knex";


// in src/db/migrations/YYYYMMDDHHMMSS_create_users_table.js
exports.up = function(Knex: Knex) {
  return Knex.schema.createTable('users', function(table) {
    table.increments('id').primary();
    table.string('username').notNullable().unique();
    table.string('password_hash').notNullable();
    table.timestamps(true, true);
  });
};

exports.down = function(Knex: Knex) {
  return Knex.schema.dropTableIfExists('users');
};