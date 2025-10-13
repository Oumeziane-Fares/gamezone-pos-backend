import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable('sessions', (table) => {
    table.integer('paused_duration').defaultTo(0).comment('Total paused time in minutes');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.alterTable('sessions', (table) => {
    table.dropColumn('paused_duration');
  });
}