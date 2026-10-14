import mongoose from 'mongoose';
import Product from '../models/Product.js';
import User from '../models/User.js';

export const getWishlist = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .select('wishlist')
      .populate('wishlist');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json(user.wishlist);
  } catch (error) {
    return next(error);
  }
};

export const addToWishlist = async (req, res, next) => {
  try {
    const { productId } = req.body;
    if (!mongoose.isValidObjectId(productId)) {
      return res.status(400).json({ message: 'A valid productId is required' });
    }

    const productExists = await Product.exists({ _id: productId });
    if (!productExists) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $addToSet: { wishlist: productId } },
      { new: true },
    )
      .select('wishlist')
      .populate('wishlist');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json(user.wishlist);
  } catch (error) {
    return next(error);
  }
};

export const removeFromWishlist = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.productId)) {
      return res.status(400).json({ message: 'Invalid product ID' });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $pull: { wishlist: req.params.productId } },
      { new: true },
    )
      .select('wishlist')
      .populate('wishlist');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json(user.wishlist);
  } catch (error) {
    return next(error);
  }
};
