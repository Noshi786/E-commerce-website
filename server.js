import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import passport from 'passport';
import connectDB from './config/db.js';
import './config/passport.js';

// Routes import karein
import productRoutes from './routes/productRoutes.js';
import authRoutes from './routes/authRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import wishlistRoutes from './routes/wishlistRoutes.js';
import addressRoutes from './routes/addressRoutes.js';
import adminUserRoutes from './routes/adminUserRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import adminDashboardRoutes from './routes/adminDashboardRoutes.js';

dotenv.config();

const app = express();

app.use(express.json());
app.use(cors());
app.use(passport.initialize());

app.get('/', (req, res) => {
  res.send('E-commerce Backend API is running...');
});

app.use('/api', async (req, res, next) => {
  try {
    await connectDB();
    return next();
  } catch (error) {
    console.error(`MongoDB connection failed (${error.name}).`);
    return res.status(503).json({ message: 'Database is unavailable. Please try again shortly.' });
  }
});

app.get('/api/health', (req, res) => {
  return res.json({ status: 'ok' });
});

app.use('/api/products', productRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/users/me/addresses', addressRoutes);
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/admin/dashboard', adminDashboardRoutes);

const PORT = Number(process.env.PORT || 3100);

if (!process.env.VERCEL) {
  connectDB().catch((error) => {
    console.error(`MongoDB connection failed (${error.name}).`);
  });

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;