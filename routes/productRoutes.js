import express from 'express';
import {
  createProduct,
  deleteProduct,
  getProductFilters,
  getProductById,
  getProducts,
  getRelatedProducts,
  updateProduct,
} from '../controllers/productController.js';
import { createProductReview } from '../controllers/reviewController.js';
import { admin, protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/').get(getProducts).post(protect, admin, createProduct);
router.get('/filters', getProductFilters);
router.route('/:id/related').get(getRelatedProducts);
router.route('/:id/reviews').post(protect, createProductReview);
router.route('/:id').get(getProductById).patch(protect, admin, updateProduct).delete(protect, admin, deleteProduct);

export default router;