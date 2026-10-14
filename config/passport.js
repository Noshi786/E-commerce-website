import 'dotenv/config';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/User.js';

export const googleOAuthEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);

if (googleOAuthEnabled) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL:
          process.env.GOOGLE_CALLBACK_URL ||
          `${process.env.API_BASE_URL || 'http://localhost:3100'}/api/auth/google/callback`,
      },
      async (accessToken, refreshToken, profile, done) => {
        const email = profile.emails
          ?.find((entry) => entry.verified)
          ?.value.toLowerCase();
        try {
          if (!email) {
            return done(null, false, { message: 'Google did not provide a verified email' });
          }

          let user = await User.findOne({ googleId: profile.id });
          if (!user) {
            user = await User.findOne({ email: email.toLowerCase() });
            if (user?.googleId && user.googleId !== profile.id) {
              return done(null, false, { message: 'This email is linked to another Google account' });
            }
            if (!user) {
              user = new User({
                name: profile.displayName || email,
                email: email.toLowerCase(),
                googleId: profile.id,
              });
            } else {
              user.googleId = profile.id;
            }
            await user.save();
          }

          if (user.isActive === false) {
            return done(null, false, { message: 'This account has been deactivated' });
          }

          return done(null, user);
        } catch (error) {
          if (error.code === 11000) {
            try {
              const user = email ? await User.findOne({ email }) : null;
              if (user?.isActive !== false && user?.googleId === profile.id) {
                return done(null, user);
              }
            } catch (lookupError) {
              return done(lookupError);
            }
          }
          return done(error);
        }
      },
    ),
  );
}
