import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable('receipts', (table) => {
    table.decimal('base_hourly_rate', 10, 2).nullable();
    table.decimal('hourly_rate_2v2', 10, 2).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.alterTable('receipts', (table) => {
    table.dropColumn('base_hourly_rate');
    table.dropColumn('hourly_rate_2v2');
  });
}