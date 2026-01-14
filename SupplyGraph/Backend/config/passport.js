// Load environment variables FIRST before anything else
require("dotenv").config();

const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

// Get callback URL from environment or use default
const getCallbackURL = () => {
  // In production, Render provides the full URL via BACKEND_URL or RENDER_EXTERNAL_URL
  // For OAuth, we need the full URL including https://
  const backendUrl = process.env.BACKEND_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    (process.env.PORT ? `https://${process.env.RENDER_SERVICE_NAME || 'your-backend'}.onrender.com` : null) ||
    "http://localhost:5000";

  // Ensure we have the protocol
  let url = backendUrl;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    // If no protocol, assume https in production, http in development
    url = process.env.NODE_ENV === 'production' ? `https://${url}` : `http://${url}`;
  }

  const callbackURL = `${url}/api/auth/google/callback`;

  // Log the callback URL for debugging
  console.log('🔐 OAuth Callback URL:', callbackURL);

  return callbackURL;
};
const User = require("../models/User");

// Validate OAuth credentials
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.warn('⚠️  WARNING: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set. OAuth will not work.');
}

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: getCallbackURL()
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        if (!profile || !profile.emails || !profile.emails[0]) {
          console.error('❌ OAuth Error: No email in profile', profile);
          return done(new Error('No email found in Google profile'), null);
        }

        const email = profile.emails[0].value;
        let user = await User.findOne({ googleId: profile.id });

        if (!user) {
          user = await User.create({
            googleId: profile.id,
            email,
            name: profile.displayName
          });
          console.log('✅ New user created via OAuth:', email);
        } else {
          console.log('✅ Existing user logged in via OAuth:', email);
        }

        return done(null, user);
      } catch (err) {
        console.error('❌ OAuth Error:', err);
        return done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    console.error('❌ Deserialize user error:', err);
    done(err, null);
  }
});

module.exports = passport;
