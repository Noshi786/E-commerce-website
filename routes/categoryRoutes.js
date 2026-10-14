import express from 'express';
import {
  createCategory,
  deleteCategory,
  getCategories,
  updateCategory,
} from '../controllers/categoryController.js';
import { admin, protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/').get(getCategories).post(protect, admin, createCategory);
router.route('/:id').patch(protect, admin, updateCategory).delete(protect, admin, deleteCategory);

export default router;
