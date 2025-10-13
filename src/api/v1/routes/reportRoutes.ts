import { Router } from 'express';
import { protect } from '../../../middleware/authMiddleware';
import * as reportController from '../controllers/reportController';

const router = Router();
//router.use(protect); // Secure this route

// Dashboard statistics endpoint
router.get('/dashboard', reportController.getDashboardStats);

// Revenue reports
router.get('/revenue', reportController.getRevenueReport);

// Session reports
router.get('/sessions', reportController.getSessionReport);

// Top products
router.get('/top-products', reportController.getTopProducts);
export default router;