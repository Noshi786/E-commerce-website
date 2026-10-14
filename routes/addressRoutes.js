import express from 'express';
import {
  addAddress,
  deleteAddress,
  getAddresses,
  updateAddress,
} from '../controllers/addressController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);
router.route('/').get(getAddresses).post(addAddress);
router.route('/:addressId').patch(updateAddress).delete(deleteAddress);

export default router;
