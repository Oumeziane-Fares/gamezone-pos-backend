import db from '../db/knex'; // Your Knex instance
import { Product } from '../types'; // Assuming you have a Product type
import { ulid } from 'ulid';

// Define interfaces for the data structures
interface StockInvoiceInput {
  supplier_name?: string;
  invoice_date: string | Date; // Date from the invoice document
  received_date?: string | Date; // When you added it (defaults to now)
  notes?: string;
}

interface StockInvoiceItemInput {
  product_id: string;
  quantity_received: number;
  unit_cost: number;
}

// Interface for the created/returned invoice
// Adjusted based on actual DB columns + transaction return
interface StockInvoice {
  id: string;
  supplier_name?: string;
  invoice_date: Date | string; // Knex might return Date object
  received_date: Date | string;
  total_cost: number;
  notes?: string;
  created_at: Date | string;
  updated_at: Date | string;
}

// Interface for the created/returned invoice item
// Adjusted based on actual DB columns + transaction return
interface StockInvoiceItem {
  id: number;
  invoice_id: string;
  product_id: string | null; // Product ID can be null if product deleted
  quantity_received: number;
  unit_cost: number;
  subtotal: number;
  product?: Partial<Product>; // Optionally include product details when fetching
}


/**
 * Creates a new stock invoice, adds items, updates product stock levels,
 * AND updates the product's main cost field.
 * Uses a transaction to ensure all operations succeed or fail together.
 */
export const createStockInvoice = async (
  invoiceData: StockInvoiceInput,
  itemsData: StockInvoiceItemInput[]
): Promise<StockInvoice & { items: StockInvoiceItem[] }> => { // Return type includes items

  if (!itemsData || itemsData.length === 0) {
    throw new Error('Invoice must contain at least one item.');
  }

  // Calculate total cost and item subtotals, ensuring correct formatting
  let calculatedTotalCost = 0;
  const itemsToInsert = itemsData.map(item => {
    if (item.quantity_received <= 0 || item.unit_cost < 0) {
      throw new Error(`Invalid quantity or cost for product ID ${item.product_id}. Quantity must be positive, cost must be non-negative.`);
    }
    const subtotal = item.quantity_received * item.unit_cost;
    calculatedTotalCost += subtotal;
    // Ensure unit_cost and subtotal have max 2 decimal places for DB consistency
    return {
      ...item,
      unit_cost: parseFloat(item.unit_cost.toFixed(2)),
      subtotal: parseFloat(subtotal.toFixed(2))
    };
  });

  // Start a database transaction
  return db.transaction(async (trx) => {
    // 1. Insert the main invoice record
    const invoiceId = `inv_${ulid()}`;
    const [newInvoice] = await trx('stock_invoices')
      .insert({
        id: invoiceId,
        supplier_name: invoiceData.supplier_name,
        invoice_date: new Date(invoiceData.invoice_date),
        received_date: invoiceData.received_date ? new Date(invoiceData.received_date) : new Date(),
        total_cost: parseFloat(calculatedTotalCost.toFixed(2)), // Store calculated total with 2 decimal places
        notes: invoiceData.notes,
        // created_at and updated_at handled by DB timestamps(true, true) in migration
      })
      .returning('*'); // Return the created invoice object

    // 2. Prepare and insert the invoice items linked to the new invoice ID
    const itemInserts = itemsToInsert.map(item => ({
      // Map directly from itemsToInsert which already has calculated subtotal and formatted unit_cost
      invoice_id: newInvoice.id,
      product_id: item.product_id,
      quantity_received: item.quantity_received,
      unit_cost: item.unit_cost, // Already formatted
      subtotal: item.subtotal // Already calculated and formatted
    }));
    const insertedItems = await trx('stock_invoice_items')
      .insert(itemInserts)
      .returning('*'); // Return the created item objects

    // 3. Update product stock levels AND cost
    for (const item of itemsToInsert) {
      // Increment stock
      await trx('products')
        .where('id', item.product_id)
        .increment('stock', item.quantity_received); //

      // --- Update the main product cost ---
      await trx('products')
        .where('id', item.product_id)
        .update({
          cost: item.unit_cost // Update cost to the unit cost (already formatted) from this invoice
        });
      // --- END Update ---
    }

    // Ensure final return object matches interface structure
    const finalInvoiceResult: StockInvoice = {
        id: newInvoice.id,
        supplier_name: newInvoice.supplier_name,
        invoice_date: newInvoice.invoice_date,
        received_date: newInvoice.received_date,
        total_cost: parseFloat(newInvoice.total_cost),
        notes: newInvoice.notes,
        created_at: newInvoice.created_at,
        updated_at: newInvoice.updated_at,
    };

    const finalItemsResult: StockInvoiceItem[] = insertedItems.map(dbItem => ({
        id: dbItem.id,
        invoice_id: dbItem.invoice_id,
        product_id: dbItem.product_id,
        quantity_received: dbItem.quantity_received,
        unit_cost: parseFloat(dbItem.unit_cost),
        subtotal: parseFloat(dbItem.subtotal),
    }));

    // Return the created invoice and its items
    return {
      ...finalInvoiceResult,
      items: finalItemsResult
    };
  }); // Transaction ends here
};

/**
 * Fetches all stock invoices (basic details only).
 */
export const findAllStockInvoices = async (): Promise<Omit<StockInvoice, 'notes' | 'items'>[]> => { // Adjusted return type
  const invoices = await db('stock_invoices')
    .select(
      'id',
      'supplier_name',
      'invoice_date',
      'received_date',
      'total_cost',
      'created_at',
      'updated_at'
    )
    .orderBy('received_date', 'desc'); //

    // Ensure correct types before returning
    return invoices.map(inv => ({
        ...inv,
        total_cost: parseFloat(inv.total_cost) // Ensure number
    }));
};


/**
 * Fetches a single stock invoice by its ID, including its items and product details.
 */
export const findStockInvoiceById = async (id: string): Promise<(StockInvoice & { items: StockInvoiceItem[] }) | undefined> => {
  // 1. Get the invoice details
  const invoice = await db('stock_invoices').where({ id }).first();
  if (!invoice) {
    return undefined;
  }

  // 2. Get the associated items and join with product details
  const items = await db('stock_invoice_items as sii')
    .leftJoin('products as p', 'sii.product_id', 'p.id') // Join condition remains the same
    .where('sii.invoice_id', id)
    .select(
      // Item details
      'sii.id',
      'sii.invoice_id',
      'sii.product_id',
      'sii.quantity_received',
      'sii.unit_cost',
      'sii.subtotal',
      // Product details (potentially null if join fails or product deleted)
      'p.name as product_name',
      'p.category as product_category'
      // We don't strictly need 'p.id as actual_product_id' anymore for the check
    )
    .orderBy('sii.id');

  // 3. Combine and return, ensuring correct types
  const finalInvoiceResult: StockInvoice = {
      id: invoice.id,
      supplier_name: invoice.supplier_name,
      invoice_date: invoice.invoice_date,
      received_date: invoice.received_date,
      total_cost: parseFloat(invoice.total_cost),
      notes: invoice.notes,
      created_at: invoice.created_at,
      updated_at: invoice.updated_at,
  };

  const finalItemsResult: StockInvoiceItem[] = items.map(dbItem => ({
      id: dbItem.id,
      invoice_id: dbItem.invoice_id,
      product_id: dbItem.product_id, // Keep original product_id link
      quantity_received: dbItem.quantity_received,
      unit_cost: parseFloat(dbItem.unit_cost),
      subtotal: parseFloat(dbItem.subtotal),
      // --- REVISED CHECK ---
      // If product_name from the join is not null, assume join succeeded
      product: dbItem.product_name ? {
          id: dbItem.product_id, // Use the ID stored on the item
          name: dbItem.product_name,
          category: dbItem.product_category,
      } : undefined // Otherwise, product is undefined
      // --- END REVISED CHECK ---
  }));

  return {
    ...finalInvoiceResult,
    items: finalItemsResult
  };
};