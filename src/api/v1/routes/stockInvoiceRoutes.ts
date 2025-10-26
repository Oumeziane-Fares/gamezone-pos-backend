import { Router } from 'express';
import { protect } from '../../../middleware/authMiddleware'; // Assuming your middleware is here
import {
  createStockInvoice,
  getAllStockInvoices,
  getStockInvoiceById,
} from '../controllers/stockInvoiceController'; // Adjust path if needed

const router = Router();

// --- Apply Authentication Middleware ---
// You'll likely want to protect these routes so only logged-in users can manage stock.
//router.use(protect); // <-- Make sure to uncomment this when you have authentication set up correctly.

// --- Define Routes ---

// POST /api/v1/stock-invoices
// Creates a new stock invoice and updates stock levels
router.post('/', createStockInvoice);

// GET /api/v1/stock-invoices
// Gets a summary list of all stock invoices
router.get('/', getAllStockInvoices);

// GET /api/v1/stock-invoices/:id
// Gets the details of a specific stock invoice, including its items
router.get('/:id', getStockInvoiceById);


export default router;