import { Router } from 'express';
import * as sessionController from '../controllers/sessionController';
import { protect } from '../../../middleware/authMiddleware';


const router = Router();

// Apply authentication middleware to all routes
//router.use(protect);

// Session routes
router.post('/', sessionController.createSession);
router.get('/active', sessionController.getActiveSessions);
router.get('/:id', sessionController.getSessionById);
router.patch('/:id/pause', sessionController.pauseSession);
router.patch('/:id/resume', sessionController.resumeSession);
router.post('/:id/end', sessionController.endSession);
router.post('/:id/items', sessionController.addItemToSession);


export default router;