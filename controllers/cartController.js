import mongoose from 'mongoose';
import Cart from '../models/Cart.js';
import Product from '../models/Product.js';

const roundMoney = (amount) => Math.round(amount * 100) / 100;

const recalculateSubtotal = (cart) => {
  cart.subtotal = roundMoney(
    cart.items.reduce((subtotal, item) => subtotal + item.price * item.quantity, 0),
  );
};

const getOrCreateCart = async (userId) => {
  let cart = await Cart.findOne({ user: userId });

  if (!cart) {
    cart = new Cart({ user: userId, items: [], subtotal: 0 });
  }

  return cart;
};

const getProductPrice = (product, selectedVariant) => {
  if (!Array.isArray(product.variants) || product.variants.length === 0) {
    return { selectedVariant: {}, price: product.price };
  }

  if (!selectedVariant || typeof selectedVariant !== 'object') {
    return null;
  }

  const variant = product.variants.find(
    (option) =>
      (option.size ?? undefined) === (selectedVariant.size ?? undefined) &&
      (option.color ?? undefined) === (selectedVariant.color ?? undefined),
  );

  if (!variant) {
    return null;
  }

  return {
    selectedVariant: {
      ...(variant.size ? { size: variant.size } : {}),
      ...(variant.color ? { color: variant.color } : {}),
    },
    price: roundMoney(product.price + (variant.additionalPrice || 0)),
  };
};

const isValidQuantity = (quantity) =>
  Number.isInteger(quantity) && quantity > 0;

export const getMyCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    return res.json(cart || { items: [], subtotal: 0 });
  } catch (error) {
    return next(error);
  }
};

export const addCartItem = async (req, res, next) => {
  try {
    const { productId, quantity = 1, selectedVariant } = req.body;

    if (!productId || !isValidQuantity(quantity)) {
      return res.status(400).json({ message: 'A productId and positive integer quantity are required' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const pricing = getProductPrice(product, selectedVariant);
    if (!pricing) {
      return res.status(400).json({ message: 'Selected product variant is not available' });
    }

    const cart = await getOrCreateCart(req.user._id);
    const existingItem = cart.items.find(
      (item) =>
        item.product.toString() === product._id.toString() &&
        (item.selectedVariant?.size ?? undefined) ===
          (pricing.selectedVariant.size ?? undefined) &&
        (item.selectedVariant?.color ?? undefined) ===
          (pricing.selectedVariant.color ?? undefined),
    );
    const nextQuantity = (existingItem?.quantity || 0) + quantity;

    if (nextQuantity > product.stock) {
      return res.status(400).json({ message: 'Requested quantity exceeds available stock' });
    }

    if (existingItem) {
      existingItem.quantity = nextQuantity;
      existingItem.price = pricing.price;
    } else {
      cart.items.push({
        product: product._id,
        quantity,
        selectedVariant: pricing.selectedVariant,
        price: pricing.price,
      });
    }

    recalculateSubtotal(cart);
    await cart.save();
    return res.status(200).json(cart);
  } catch (error) {
    return next(error);
  }
};

export const mergeGuestCart = async (req, res, next) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length > 100) {
      return res.status(400).json({ message: 'items must be an array with at most 100 entries' });
    }
    if (
      items.some(
        (item) =>
          !item ||
          !mongoose.isValidObjectId(item.productId) ||
          !isValidQuantity(item.quantity),
      )
    ) {
      return res.status(400).json({
        message: 'Each item requires a valid productId and positive integer quantity',
      });
    }

    const cart = await getOrCreateCart(req.user._id);
    const mergedItems = cart.items.map((item) => ({
      product: item.product,
      quantity: item.quantity,
      selectedVariant: {
        ...(item.selectedVariant?.size ? { size: item.selectedVariant.size } : {}),
        ...(item.selectedVariant?.color ? { color: item.selectedVariant.color } : {}),
      },
      price: item.price,
    }));

    for (const guestItem of items) {
      const product = await Product.findById(guestItem.productId);
      if (!product) {
        return res.status(404).json({ message: `Product ${guestItem.productId} not found` });
      }

      const pricing = getProductPrice(product, guestItem.selectedVariant);
      if (!pricing) {
        return res.status(400).json({
          message: `Selected variant for ${product.title} is not available`,
        });
      }

      const existingItem = mergedItems.find(
        (item) =>
          item.product.toString() === product._id.toString() &&
          (item.selectedVariant.size ?? undefined) ===
            (pricing.selectedVariant.size ?? undefined) &&
          (item.selectedVariant.color ?? undefined) ===
            (pricing.selectedVariant.color ?? undefined),
      );
      const mergedQuantity = (existingItem?.quantity || 0) + guestItem.quantity;

      if (mergedQuantity > product.stock) {
        return res.status(400).json({
          message: `Requested quantity for ${product.title} exceeds available stock`,
        });
      }

      if (existingItem) {
        existingItem.quantity = mergedQuantity;
        existingItem.price = pricing.price;
      } else {
        mergedItems.push({
          product: product._id,
          quantity: guestItem.quantity,
          selectedVariant: pricing.selectedVariant,
          price: pricing.price,
        });
      }
    }

    cart.items = mergedItems;
    recalculateSubtotal(cart);
    await cart.save();
    return res.json(cart);
  } catch (error) {
    return next(error);
  }
};

export const updateCartItem = async (req, res, next) => {
  try {
    const { quantity } = req.body;
    if (!isValidQuantity(quantity)) {
      return res.status(400).json({ message: 'Quantity must be a positive integer' });
    }

    const cart = await Cart.findOne({ user: req.user._id });
    const item = cart?.items.id(req.params.itemId);

    if (!item) {
      return res.status(404).json({ message: 'Cart item not found' });
    }

    const product = await Product.findById(item.product);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (quantity > product.stock) {
      return res.status(400).json({ message: 'Requested quantity exceeds available stock' });
    }

    const pricing = getProductPrice(product, item.selectedVariant);
    if (!pricing) {
      return res.status(400).json({ message: 'Selected product variant is no longer available' });
    }

    item.quantity = quantity;
    item.price = pricing.price;
    recalculateSubtotal(cart);
    await cart.save();
    return res.json(cart);
  } catch (error) {
    return next(error);
  }
};

export const removeCartItem = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    const item = cart?.items.id(req.params.itemId);

    if (!cart || !item) {
      return res.status(404).json({ message: 'Cart item not found' });
    }

    item.deleteOne();
    recalculateSubtotal(cart);
    await cart.save();
    return res.json(cart);
  } catch (error) {
    return next(error);
  }
};

export const clearCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
      return res.json({ items: [], subtotal: 0 });
    }

    cart.items = [];
    cart.subtotal = 0;
    await cart.save();
    return res.json(cart);
  } catch (error) {
    return next(error);
  }
};
