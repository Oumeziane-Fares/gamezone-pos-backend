import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('stock_invoice_items', (table) => {
    table.increments('id').primary(); // Simple auto-incrementing ID for items
    
    // Link to the stock_invoices table
    table.string('invoice_id')
         .notNullable()
         .references('id')
         .inTable('stock_invoices')
         .onDelete('CASCADE'); // If invoice is deleted, delete its items
         
    // Link to the products table
    table.string('product_id')
         .nullable() // Allow null if product is deleted later
         .references('id')
         .inTable('products')
         .onDelete('SET NULL'); // Keep item history even if product is deleted
         
    table.integer('quantity_received').notNullable(); // How many units came in
    table.decimal('unit_cost', 10, 2).notNullable(); // Cost per unit *for this invoice*
    table.decimal('subtotal', 10, 2).notNullable(); // quantity * unit_cost
    
    // No separate timestamps needed here usually, rely on invoice timestamps
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('stock_invoice_items');
}