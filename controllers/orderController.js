import mongoose from 'mongoose';
import Cart from '../models/Cart.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';

const SHIPPING_FEE = 250;
const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
const PAYMENT_STATUSES = ['pending', 'completed', 'failed'];

const checkoutError = (message, statusCode = 400) =>
  Object.assign(new Error(message), { statusCode });

const isValidShippingAddress = (address) =>
  address &&
  ['street', 'city', 'state', 'postalCode', 'country'].every(
    (field) => typeof address[field] === 'string' && address[field].trim(),
  );

const createOrderFromItems = async ({
  items,
  userId,
  guestName,
  guestEmail,
  shippingAddress,
}) => {
  const session = await mongoose.startSession();

  try {
    let createdOrder;

    await session.withTransaction(async () => {
      let cart;
      let orderSourceItems = items;
      if (userId) {
        cart = await Cart.findOne({ user: userId }).session(session);
        if (!cart || cart.items.length === 0) {
          throw checkoutError('Your cart is empty');
        }
        orderSourceItems = cart.items.map((item) => ({
          product: item.product,
          quantity: item.quantity,
          selectedVariant: item.selectedVariant,
        }));
      }

      let subtotal = 0;
      const orderItems = [];

      for (const item of orderSourceItems) {
        if (!Number.isInteger(item.quantity) || item.quantity < 1) {
          throw checkoutError('Cart contains an invalid item quantity');
        }

        const product = await Product.findById(item.product).session(session);
        if (!product) {
          throw checkoutError('A product in your cart is no longer available');
        }

        let unitPrice = product.price;
        if (product.variants.length > 0) {
          const selectedVariant = product.variants.find(
            (variant) =>
              (variant.size ?? undefined) === (item.selectedVariant?.size ?? undefined) &&
              (variant.color ?? undefined) === (item.selectedVariant?.color ?? undefined),
          );

          if (!selectedVariant) {
            throw checkoutError(`${product.title} has a variant that is no longer available`);
          }

          unitPrice += selectedVariant.additionalPrice || 0;
        }

        const updatedProduct = await Product.findOneAndUpdate(
          { _id: product._id, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } },
          { returnDocument: 'after', session },
        );

        if (!updatedProduct) {
          throw checkoutError(`Insufficient stock for ${product.title}`);
        }

        unitPrice = Math.round(unitPrice * 100) / 100;
        subtotal += unitPrice * item.quantity;
        orderItems.push({
          product: product._id,
          title: product.title,
          quantity: item.quantity,
          price: unitPrice,
          selectedVariant: item.selectedVariant,
        });
      }

      subtotal = Math.round(subtotal * 100) / 100;
      const totalAmount = Math.round((subtotal + SHIPPING_FEE) * 100) / 100;
      const orderData = {
        orderItems,
        shippingAddress,
        subtotal,
        shippingFee: SHIPPING_FEE,
        discount: 0,
        totalAmount,
      };
      if (userId) {
        orderData.user = userId;
      } else {
        orderData.guestName = guestName;
        orderData.guestEmail = guestEmail;
      }

      const [order] = await Order.create([orderData], { session });
      if (cart) {
        cart.items = [];
        cart.subtotal = 0;
        await cart.save({ session });
      }
      createdOrder = order;
    });

    return createdOrder;
  } finally {
    await session.endSession();
  }
};

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
export const addOrderItems = async (req, res, next) => {
  try {
    const { shippingAddress } = req.body;
    if (!isValidShippingAddress(shippingAddress)) {
      return res.status(400).json({
        message: 'A complete shippingAddress (street, city, state, postalCode, country) is required',
      });
    }

    const createdOrder = await createOrderFromItems({
      items: [],
      userId: req.user._id,
      shippingAddress,
    });

    return res.status(201).json(createdOrder);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    return next(error);
  }
};

export const createGuestOrder = async (req, res, next) => {
  try {
    const { name, email, items, shippingAddress } = req.body;
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: 'A customer name is required' });
    }
    if (
      typeof email !== 'string' ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
      return res.status(400).json({ message: 'A valid customer email is required' });
    }
    if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
      return res.status(400).json({ message: 'items must contain between 1 and 100 products' });
    }
    if (!isValidShippingAddress(shippingAddress)) {
      return res.status(400).json({
        message: 'A complete shippingAddress (street, city, state, postalCode, country) is required',
      });
    }
    if (
      items.some(
        (item) =>
          !item ||
          !mongoose.isValidObjectId(item.productId) ||
          !Number.isInteger(item.quantity) ||
          item.quantity < 1 ||
          (item.selectedVariant !== undefined &&
            (!item.selectedVariant ||
              typeof item.selectedVariant !== 'object' ||
              Array.isArray(item.selectedVariant) ||
              ['size', 'color'].some(
                (field) =>
                  item.selectedVariant[field] !== undefined &&
                  typeof item.selectedVariant[field] !== 'string',
              ))),
      )
    ) {
      return res.status(400).json({
        message: 'Each item requires a valid productId, positive integer quantity, and optional size/color variant',
      });
    }

    const createdOrder = await createOrderFromItems({
      items: items.map((item) => ({
        product: item.productId,
        quantity: item.quantity,
        selectedVariant: item.selectedVariant,
      })),
      guestName: name.trim(),
      guestEmail: email.trim().toLowerCase(),
      shippingAddress,
    });

    return res.status(201).json(createdOrder);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    return next(error);
  }
};

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
export const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    
    if (order) {
      if (
        (!order.user || order.user.toString() !== req.user._id.toString()) &&
        req.user.role !== 'admin'
      ) {
        return res.status(403).json({ message: 'Not authorized to view this order' });
      }

      const populatedOrder = await order.populate('user', 'name email');
      return res.json(populatedOrder);
    } else {
      return res.status(404).json({ message: 'Order not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get logged-in user orders
// @route   GET /api/orders/myorders
// @access  Private
export const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAllOrders = async (req, res, next) => {
  try {
    const { orderStatus, paymentStatus, cancellationRequested } = req.query;
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);

    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
      return res.status(400).json({ message: 'page must be >= 1 and limit must be between 1 and 100' });
    }
    if (orderStatus !== undefined && !ORDER_STATUSES.includes(orderStatus)) {
      return res.status(400).json({
        message: `orderStatus must be one of: ${ORDER_STATUSES.join(', ')}`,
      });
    }
    if (paymentStatus !== undefined && !PAYMENT_STATUSES.includes(paymentStatus)) {
      return res.status(400).json({
        message: `paymentStatus must be one of: ${PAYMENT_STATUSES.join(', ')}`,
      });
    }
    if (
      cancellationRequested !== undefined &&
      !['true', 'false'].includes(cancellationRequested)
    ) {
      return res.status(400).json({ message: 'cancellationRequested must be true or false' });
    }

    const filter = {};
    if (orderStatus) filter.orderStatus = orderStatus;
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (cancellationRequested !== undefined) {
      filter.cancellationRequested = cancellationRequested === 'true';
    }

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('user', 'name email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Order.countDocuments(filter),
    ]);
    return res.json({
      orders,
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    return next(error);
  }
};

export const requestOrderCancellation = async (req, res, next) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (!['pending', 'processing'].includes(order.orderStatus)) {
      return res.status(400).json({
        message: 'Cancellation can only be requested for pending or processing orders',
      });
    }

    if (order.cancellationRequested) {
      return res.status(409).json({ message: 'Cancellation has already been requested' });
    }

    order.cancellationRequested = true;
    await order.save();
    return res.json(order);
  } catch (error) {
    return next(error);
  }
};

export const updateOrderStatus = async (req, res, next) => {
  const { orderStatus } = req.body;
  if (!ORDER_STATUSES.includes(orderStatus)) {
    return res.status(400).json({
      message: `orderStatus must be one of: ${ORDER_STATUSES.join(', ')}`,
    });
  }

  let session;
  try {
    session = await mongoose.startSession();
    let updatedOrder;

    await session.withTransaction(async () => {
      const order = await Order.findById(req.params.id).session(session);
      if (!order) {
        throw checkoutError('Order not found', 404);
      }

      if (
        orderStatus === 'cancelled' &&
        !['pending', 'processing'].includes(order.orderStatus)
      ) {
        throw checkoutError('Only pending or processing orders can be cancelled', 400);
      }

      if (orderStatus === 'cancelled' && order.orderStatus !== 'cancelled') {
        for (const item of order.orderItems) {
          await Product.updateOne(
            { _id: item.product },
            { $inc: { stock: item.quantity } },
            { session },
          );
        }
      }

      order.orderStatus = orderStatus;
      order.cancellationRequested = false;
      await order.save({ session });
      updatedOrder = order;
    });

    return res.json(updatedOrder);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    return next(error);
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

export const updatePaymentStatus = async (req, res, next) => {
  const { paymentStatus } = req.body;
  if (!PAYMENT_STATUSES.includes(paymentStatus)) {
    return res.status(400).json({
      message: `paymentStatus must be one of: ${PAYMENT_STATUSES.join(', ')}`,
    });
  }

  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    order.paymentStatus = paymentStatus;
    await order.save();
    return res.json(order);
  } catch (error) {
    return next(error);
  }
};