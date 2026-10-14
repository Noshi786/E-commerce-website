import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true }
}, { timestamps: true });

const productSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  category: { type: String, required: true, index: true },
  brand: { type: String, required: true, index: true },
  stock: { type: Number, required: true, min: 0, default: 0 },
  images: [{ type: String, required: true }],
  variants: [{
    size: { type: String },
    color: { type: String },
    additionalPrice: { type: Number, default: 0 }
  }],
  ratings: [reviewSchema],
  averageRating: { type: Number, default: 0 },
  numReviews: { type: Number, default: 0 }
}, { timestamps: true });

const Product = mongoose.model('Product', productSchema);

export default Product;