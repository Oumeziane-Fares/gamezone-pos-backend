import { Router } from 'express';
import { protect } from '../../../middleware/authMiddleware'; // Import the middleware
import { 
  getAllProducts, 
  getProductById,
  createNewProduct,
  updateExistingProduct,
  deleteExistingProduct
} from '../controllers/productController';

const router = Router();
//router.use(protect);    // Apply the middleware to all routes in this router

router.get('/', getAllProducts);
router.post('/', createNewProduct);

router.get('/:id', getProductById);
router.put('/:id', updateExistingProduct);
router.delete('/:id', deleteExistingProduct);

export default router;