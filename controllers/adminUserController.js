import mongoose from 'mongoose';
import User from '../models/User.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const getUsers = async (req, res, next) => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
      return res.status(400).json({ message: 'page must be >= 1 and limit must be between 1 and 100' });
    }

    const filter = {};
    if (typeof req.query.search === 'string' && req.query.search.trim()) {
      const expression = new RegExp(escapeRegex(req.query.search.trim()), 'i');
      filter.$or = [{ name: expression }, { email: expression }];
    }
    if (req.query.role !== undefined) {
      if (!['customer', 'admin'].includes(req.query.role)) {
        return res.status(400).json({ message: 'role must be customer or admin' });
      }
      filter.role = req.query.role;
    }
    if (req.query.isActive !== undefined) {
      if (!['true', 'false'].includes(req.query.isActive)) {
        return res.status(400).json({ message: 'isActive must be true or false' });
      }
      filter.isActive = req.query.isActive === 'true';
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('name email role isActive createdAt')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      User.countDocuments(filter),
    ]);

    return res.json({
      users: users.map((user) => ({
        ...user.toObject(),
        isActive: user.isActive !== false,
      })),
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    return next(error);
  }
};

export const updateUserStatus = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    if (typeof req.body?.isActive !== 'boolean') {
      return res.status(400).json({ message: 'isActive must be a boolean' });
    }
    if (
      new mongoose.Types.ObjectId(req.params.id).equals(req.user._id) &&
      !req.body.isActive
    ) {
      return res.status(400).json({ message: 'You cannot deactivate your own account' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { isActive: req.body.isActive } },
      { new: true, runValidators: true },
    ).select('name email role isActive createdAt');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json(user);
  } catch (error) {
    return next(error);
  }
};
