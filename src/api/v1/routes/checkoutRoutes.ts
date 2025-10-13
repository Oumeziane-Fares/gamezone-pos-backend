import { Router } from 'express';
import { protect } from '../../../middleware/authMiddleware';
import { handleCheckout } from '../controllers/checkoutController';

const router = Router();
//router.use(protect); // Secure this route

router.post('/', handleCheckout);

export default router;