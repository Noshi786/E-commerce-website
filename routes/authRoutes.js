import express from 'express';
import passport from 'passport';
import { registerUser, authUser } from '../controllers/authController.js';
import {
  googleOAuthCallback,
  googleOAuthUnavailable,
} from '../controllers/oauthController.js';
import { googleOAuthEnabled } from '../config/passport.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', authUser);
router.get('/google', (req, res, next) => {
  if (!googleOAuthEnabled) {
    return googleOAuthUnavailable(req, res);
  }
  return passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })(req, res, next);
});
router.get(
  '/google/callback',
  (req, res, next) => {
    if (!googleOAuthEnabled) {
      return googleOAuthUnavailable(req, res);
    }
    return passport.authenticate('google', { session: false }, (error, user, info) => {
      if (error) {
        return next(error);
      }
      if (!user) {
        return res.status(401).json({
          message: info?.message || 'Google authentication failed',
        });
      }
      req.user = user;
      return googleOAuthCallback(req, res);
    })(req, res, next);
  },
);

export default router;