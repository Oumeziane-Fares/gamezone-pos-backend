import { Router } from 'express';
import { protect } from '../../../middleware/authMiddleware';
import { 
  getTransactionHistory, 
  getTransactionStats,
  getTransactionsBySession,
  searchTransactions,
  getRecentTransactions
} from '../controllers/historyController';

const router = Router();

// Secure this route when ready
// router.use(protect);

// GET /api/v1/history - Get all transaction history with enhanced details
router.get('/', getTransactionHistory);

// GET /api/v1/history/stats - Get transaction statistics for a period
router.get('/stats', getTransactionStats);

// GET /api/v1/history/recent - Get recent transactions (optional, more efficient than full history)
router.get('/recent', getRecentTransactions);

// GET /api/v1/history/search - Search transactions with filters
router.get('/search', searchTransactions);

// GET /api/v1/history/session/:sessionId - Get transactions for a specific session
router.get('/session/:sessionId', getTransactionsBySession);

export default router;