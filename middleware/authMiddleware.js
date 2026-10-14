import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { getJwtSecret } from '../utils/tokens.js';

export const protect = async (req, res, next) => {
  const authorization = req.headers.authorization;
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, getJwtSecret());
  } catch (error) {
    if (error.message.includes('JWT_SECRET')) {
      console.error(error.message);
      return res.status(500).json({ message: 'Authentication is not configured on the server' });
    }
    return res.status(401).json({ message: 'Not authorized, token failed' });
  }

  try {
    req.user = await User.findById(decoded.id).select('-password');

    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized, user not found' });
    }
    if (req.user.isActive === false) {
      return res.status(403).json({ message: 'This account has been deactivated' });
    }

    return next();
  } catch (error) {
    return next(error);
  }
};

export const admin = (req, res, next) => {
  if (req.user?.role === 'admin') {
    return next();
  }

  return res.status(403).json({ message: 'Not authorized as an admin' });
};