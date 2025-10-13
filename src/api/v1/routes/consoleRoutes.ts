import { Router } from 'express';
import {
  getAllConsoles,
  getConsoleById,
  createConsole,
  updateConsole,
  deleteConsole
} from '../controllers/consoleController';
//import { protect } from '../../../middleware/authMiddleware';

const router = Router();

// Apply authentication middleware to all routes
//router.use(protect);

// Console routes
router.get('/', getAllConsoles);
router.get('/:id', getConsoleById);
router.post('/', createConsole);
router.put('/:id', updateConsole);
router.delete('/:id', deleteConsole);

export default router;