import express from 'express';
import {
  addOrderItems,
  createGuestOrder,
  getAllOrders,
  getMyOrders,
  getOrderById,
  requestOrderCancellation,
  updateOrderStatus,
  updatePaymentStatus,
} from '../controllers/orderController.js';
import { admin, protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/guest').post(createGuestOrder);
router.route('/').post(protect, addOrderItems);
router.route('/myorders').get(protect, getMyOrders);
router.route('/admin/all').get(protect, admin, getAllOrders);
router.route('/:id/cancel-request').post(protect, requestOrderCancellation);
router.route('/:id/status').patch(protect, admin, updateOrderStatus);
router.route('/:id/payment-status').patch(protect, admin, updatePaymentStatus);
router.route('/:id').get(protect, getOrderById);

export default router;