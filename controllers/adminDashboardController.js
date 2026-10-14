import Product from '../models/Product.js';

export const getLowStockProducts = async (req, res, next) => {
  try {
    const threshold = Number(req.query.threshold ?? 5);
    if (!Number.isInteger(threshold) || threshold < 0) {
      return res.status(400).json({ message: 'threshold must be a non-negative integer' });
    }

    const products = await Product.find({ stock: { $lte: threshold } })
      .select('title category brand stock price')
      .sort({ stock: 1, title: 1 });

    return res.json({ threshold, total: products.length, products });
  } catch (error) {
    return next(error);
  }
};
