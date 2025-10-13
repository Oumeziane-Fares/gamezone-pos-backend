import type { Knex } from "knex";


// in src/db/migrations/YYYYMMDDHHMMSS_add_paused_at_to_sessions.js
exports.up = function(knex: Knex) {
  return knex.schema.table('sessions', function(table) {
    table.datetime('paused_at').nullable();
  });
};

exports.down = function(knex: Knex) {
  return knex.schema.table('sessions', function(table) {
    table.dropColumn('paused_at');
  });
};

