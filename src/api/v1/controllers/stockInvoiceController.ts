import { Request, Response, NextFunction } from 'express';
import * as stockInvoiceService from '../../../services/stockInvoiceService'; // Adjust path if needed

// Interface for the expected request body when creating an invoice
interface CreateInvoiceRequestBody {
  invoiceData: {
    supplier_name?: string;
    invoice_date: string; // Expect ISO string date from frontend
    received_date?: string; // Expect ISO string date from frontend
    notes?: string;
  };
  itemsData: Array<{
    product_id: string;
    quantity_received: number;
    unit_cost: number;
  }>;
}

/**
 * Controller to handle POST /stock-invoices
 * Creates a new stock invoice and updates product stock.
 */
export const createStockInvoice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { invoiceData, itemsData } = req.body as CreateInvoiceRequestBody;

    // --- Basic Validation ---
    if (!invoiceData || !invoiceData.invoice_date) {
      return res.status(400).json({ success: false, message: 'Invoice date is required.' });
    }
    if (!itemsData || !Array.isArray(itemsData) || itemsData.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one invoice item is required.' });
    }
    // Add more validation here if needed (e.g., check item structure)
    // --- End Validation ---

    // Call the service function to handle business logic and database operations
    const newInvoice = await stockInvoiceService.createStockInvoice(invoiceData, itemsData);

    // Send a success response
    res.status(201).json({
      success: true,
      message: 'Stock invoice created successfully and stock updated.',
      data: newInvoice,
    });

  } catch (error) {
    // Pass errors to the global error handler
    console.error('Error creating stock invoice:', error); // Log the error for debugging
    next(error);
  }
};

/**
 * Controller to handle GET /stock-invoices
 * Fetches a list of all stock invoices (summary).
 */
export const getAllStockInvoices = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Call the service function
    const invoices = await stockInvoiceService.findAllStockInvoices();

    // Send a success response
    res.status(200).json({
      success: true,
      data: invoices,
    });

  } catch (error) {
    // Pass errors to the global error handler
    console.error('Error fetching stock invoices:', error);
    next(error);
  }
};

/**
 * Controller to handle GET /stock-invoices/:id
 * Fetches details of a specific stock invoice, including its items.
 */
export const getStockInvoiceById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ success: false, message: 'Invoice ID is required.' });
    }

    // Call the service function
    const invoice = await stockInvoiceService.findStockInvoiceById(id);

    // Handle case where invoice is not found
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: `Stock invoice with ID ${id} not found.`,
      });
    }

    // Send a success response
    res.status(200).json({
      success: true,
      data: invoice,
    });

  } catch (error) {
    // Pass errors to the global error handler
    console.error(`Error fetching stock invoice ${req.params.id}:`, error);
    next(error);
  }
};