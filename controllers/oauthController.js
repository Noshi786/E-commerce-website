import { generateToken } from '../utils/tokens.js';

export const googleOAuthUnavailable = (req, res) =>
  res.status(503).json({
    message: 'Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET; GOOGLE_CALLBACK_URL is optional.',
  });

export const googleOAuthCallback = (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Google authentication failed' });
  }

  const frontendUrl = new URL(
    process.env.FRONTEND_URL
  );
  frontendUrl.hash = new URLSearchParams({
    token: generateToken(req.user._id),
    name: req.user.name,
    email: req.user.email,
    role: req.user.role,
  }).toString();

  return res.redirect(frontendUrl.toString());
};
