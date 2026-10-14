import mongoose from 'mongoose';
import Category from '../models/Category.js';
import Product from '../models/Product.js';

export const getCategories = async (req, res, next) => {
  try {
    const categories = await Category.find({}).sort({ name: 1 });
    return res.json(categories);
  } catch (error) {
    return next(error);
  }
};

export const createCategory = async (req, res, next) => {
  try {
    const { name, description = '' } = req.body ?? {};
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: 'A category name is required' });
    }
    if (typeof description !== 'string') {
      return res.status(400).json({ message: 'description must be a string' });
    }

    const category = await Category.create({
      name: name.trim(),
      description: description.trim(),
    });
    return res.status(201).json(category);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Category already exists' });
    }
    return next(error);
  }
};

export const updateCategory = async (req, res, next) => {
  let session;
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid category ID' });
    }

    const { name, description } = req.body ?? {};
    if (name === undefined && description === undefined) {
      return res.status(400).json({ message: 'Provide a name or description to update' });
    }
    if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
      return res.status(400).json({ message: 'name must be a non-empty string' });
    }
    if (description !== undefined && typeof description !== 'string') {
      return res.status(400).json({ message: 'description must be a string' });
    }

    session = await mongoose.startSession();
    let updatedCategory;
    await session.withTransaction(async () => {
      const category = await Category.findById(req.params.id).session(session);
      if (!category) {
        const error = new Error('Category not found');
        error.statusCode = 404;
        throw error;
      }

      const previousName = category.name;
      if (name !== undefined) {
        category.name = name.trim();
      }
      if (description !== undefined) {
        category.description = description.trim();
      }

      await category.save({ session });
      if (category.name !== previousName) {
        await Product.updateMany(
          { category: previousName },
          { $set: { category: category.name } },
          { session },
        );
      }
      updatedCategory = category;
    });

    return res.json(updatedCategory);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Category already exists' });
    }
    return next(error);
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

export const deleteCategory = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid category ID' });
    }

    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    const hasProducts = await Product.exists({ category: category.name });
    if (hasProducts) {
      return res.status(409).json({
        message: 'Cannot delete a category while products use it; reassign those products first',
      });
    }

    await category.deleteOne();
    return res.json({ message: 'Category removed' });
  } catch (error) {
    return next(error);
  }
};
