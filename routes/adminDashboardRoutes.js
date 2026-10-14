import express from 'express';
import { getLowStockProducts } from '../controllers/adminDashboardController.js';
import { admin, protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect, admin);
router.get('/low-stock', getLowStockProducts);

export default router;
