import Product from '../models/Product.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parseNumberQuery = (value, name, { integer = false } = {}) => {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || (integer && !Number.isInteger(parsed))) {
    throw Object.assign(new Error(`${name} must be a valid ${integer ? 'integer' : 'number'}`), {
      statusCode: 400,
    });
  }

  return parsed;
};

// @desc    Get all products
// @route   GET /api/products
// @access  Public
export const getProducts = async (req, res, next) => {
  try {
    const {
      search,
      category,
      brand,
      inStock,
      sort = 'newest',
    } = req.query;
    const page = parseNumberQuery(req.query.page, 'page', { integer: true }) ?? 1;
    const limit = parseNumberQuery(req.query.limit, 'limit', { integer: true }) ?? 20;
    const minPrice = parseNumberQuery(req.query.minPrice, 'minPrice');
    const maxPrice = parseNumberQuery(req.query.maxPrice, 'maxPrice');
    const minRating = parseNumberQuery(req.query.minRating, 'minRating');

    if (page < 1 || limit < 1 || limit > 100) {
      return res.status(400).json({ message: 'page must be >= 1 and limit must be between 1 and 100' });
    }
    if (minPrice !== undefined && minPrice < 0) {
      return res.status(400).json({ message: 'minPrice must be >= 0' });
    }
    if (maxPrice !== undefined && maxPrice < 0) {
      return res.status(400).json({ message: 'maxPrice must be >= 0' });
    }
    if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
      return res.status(400).json({ message: 'minPrice cannot be greater than maxPrice' });
    }
    if (minRating !== undefined && (minRating < 0 || minRating > 5)) {
      return res.status(400).json({ message: 'minRating must be between 0 and 5' });
    }
    if (inStock !== undefined && !['true', 'false'].includes(inStock)) {
      return res.status(400).json({ message: 'inStock must be true or false' });
    }

    const filter = {};
    if (typeof search === 'string' && search.trim()) {
      const expression = new RegExp(escapeRegex(search.trim()), 'i');
      filter.$or = [
        { title: expression },
        { description: expression },
        { brand: expression },
        { category: expression },
      ];
    }
    if (typeof category === 'string' && category.trim()) {
      filter.category = category.trim();
    }
    if (typeof brand === 'string' && brand.trim()) {
      filter.brand = brand.trim();
    }
    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {};
      if (minPrice !== undefined) filter.price.$gte = minPrice;
      if (maxPrice !== undefined) filter.price.$lte = maxPrice;
    }
    if (minRating !== undefined) {
      filter.averageRating = { $gte: minRating };
    }
    if (inStock === 'true') {
      filter.stock = { $gt: 0 };
    } else if (inStock === 'false') {
      filter.stock = 0;
    }

    const sortOptions = {
      newest: { createdAt: -1 },
      price: { price: 1 },
      '-price': { price: -1 },
      rating: { averageRating: -1, numReviews: -1 },
      popularity: { numReviews: -1, createdAt: -1 },
    };
    if (!Object.hasOwn(sortOptions, sort)) {
      return res.status(400).json({
        message: 'sort must be one of: newest, price, -price, rating, popularity',
      });
    }

    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort(sortOptions[sort])
        .skip((page - 1) * limit)
        .limit(limit),
      Product.countDocuments(filter),
    ]);

    return res.json({
      products,
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const getProductFilters = async (req, res, next) => {
  try {
    const brands = await Product.distinct('brand', { brand: { $type: 'string', $ne: '' } });
    return res.json({ brands: brands.sort((first, second) => first.localeCompare(second)) });
  } catch (error) {
    return next(error);
  }
};

// @desc    Get single product by ID
// @route   GET /api/products/:id
// @access  Public
export const getProductById = async (req, res) => {
  try {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) {
      return res.status(400).json({ message: 'Invalid product ID' });
    }

    const product = await Product.findById(req.params.id);
    if (product) {
      res.json(product);
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getRelatedProducts = async (req, res, next) => {
  try {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) {
      return res.status(400).json({ message: 'Invalid product ID' });
    }

    const product = await Product.findById(req.params.id).select('category');
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const products = await Product.find({
      category: product.category,
      _id: { $ne: product._id },
    })
      .sort({ averageRating: -1, createdAt: -1 })
      .limit(8);

    return res.json(products);
  } catch (error) {
    return next(error);
  }
};

// @desc    Create a product (Admin)
// @route   POST /api/products
// @access  Private/Admin
export const createProduct = async (req, res) => {
  try {
    const {
      title,
      description,
      price,
      category,
      brand,
      stock,
      images,
      variants,
    } = req.body;

    const product = new Product({
      title,
      description,
      price,
      category,
      brand,
      stock,
      images,
      variants,
    });

    const createdProduct = await product.save();
    res.status(201).json(createdProduct);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const PRODUCT_FIELDS = [
  'title',
  'description',
  'price',
  'category',
  'brand',
  'stock',
  'images',
  'variants',
];

export const updateProduct = async (req, res, next) => {
  try {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) {
      return res.status(400).json({ message: 'Invalid product ID' });
    }

    const fields = Object.keys(req.body).filter((field) =>
      PRODUCT_FIELDS.includes(field),
    );
    if (fields.length === 0) {
      return res.status(400).json({ message: 'Provide at least one valid product field to update' });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    for (const field of fields) {
      product[field] = req.body[field];
    }

    const updatedProduct = await product.save();
    return res.json(updatedProduct);
  } catch (error) {
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({ message: error.message });
    }
    return next(error);
  }
};

export const deleteProduct = async (req, res, next) => {
  try {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) {
      return res.status(400).json({ message: 'Invalid product ID' });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    await product.deleteOne();
    return res.json({ message: 'Product removed' });
  } catch (error) {
    return next(error);
  }
};