import express from 'express';
import { getUsers, updateUserStatus } from '../controllers/adminUserController.js';
import { admin, protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect, admin);
router.route('/').get(getUsers);
router.route('/:id/status').patch(updateUserStatus);

export default router;
