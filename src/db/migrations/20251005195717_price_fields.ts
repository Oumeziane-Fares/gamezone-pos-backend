import { Knex } from 'knex';

export const up = function(knex: Knex): Promise<void> {
  return knex.schema.alterTable('receipts', function(table) {
    table.decimal('manual_console_price', 10, 2).nullable(); // Manual override price
    table.decimal('calculated_console_price', 10, 2).nullable(); // Original calculated price
  });
};

export const down = function(knex: Knex): Promise<void> {
  return knex.schema.alterTable('receipts', function(table) {
    table.dropColumn('manual_console_price');
    table.dropColumn('calculated_console_price');
  });
};