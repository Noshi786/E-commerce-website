import express from 'express';
import {
  addCartItem,
  clearCart,
  getMyCart,
  mergeGuestCart,
  removeCartItem,
  updateCartItem,
} from '../controllers/cartController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);
router.route('/').get(getMyCart).delete(clearCart);
router.route('/merge').post(mergeGuestCart);
router.route('/items').post(addCartItem);
router.route('/items/:itemId').patch(updateCartItem).delete(removeCartItem);

export default router;
