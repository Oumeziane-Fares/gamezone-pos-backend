import type { Knex } from "knex";
import { ulid } from 'ulid'; // Import ulid for default ID generation

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('stock_invoices', (table) => {
    table.string('id').primary().defaultTo(`inv_${ulid()}`); // Use ulid for IDs
    table.string('supplier_name').nullable();
    table.timestamp('invoice_date').notNullable(); // When the invoice was dated
    table.timestamp('received_date').notNullable().defaultTo(knex.fn.now()); // When stock was added
    table.decimal('total_cost', 10, 2).notNullable(); // Total cost of the invoice
    table.text('notes').nullable();
    table.timestamps(true, true); // Adds created_at and updated_at
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('stock_invoices');
}