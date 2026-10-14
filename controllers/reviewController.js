import Product from '../models/Product.js';

export const createProductReview = async (req, res, next) => {
  try {
    const { rating, comment } = req.body;
    const numericRating = Number(rating);

    if (!/^[a-f\d]{24}$/i.test(req.params.id)) {
      return res.status(400).json({ message: 'Invalid product ID' });
    }
    if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ message: 'rating must be an integer between 1 and 5' });
    }
    if (typeof comment !== 'string' || !comment.trim()) {
      return res.status(400).json({ message: 'A review comment is required' });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const existingReview = product.ratings.find(
      (review) => review.user.toString() === req.user._id.toString(),
    );
    if (existingReview) {
      existingReview.rating = numericRating;
      existingReview.comment = comment.trim();
      existingReview.name = req.user.name;
    } else {
      product.ratings.push({
        user: req.user._id,
        name: req.user.name,
        rating: numericRating,
        comment: comment.trim(),
      });
    }

    product.numReviews = product.ratings.length;
    product.averageRating =
      product.ratings.reduce((sum, review) => sum + review.rating, 0) /
      product.numReviews;
    await product.save();

    return res.status(existingReview ? 200 : 201).json({
      ratings: product.ratings,
      averageRating: product.averageRating,
      numReviews: product.numReviews,
    });
  } catch (error) {
    return next(error);
  }
};
