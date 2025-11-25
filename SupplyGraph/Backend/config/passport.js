const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

// Get callback URL from environment or use default
const getCallbackURL = () => {
  // In production, Render provides the full URL via BACKEND_URL
  // For OAuth, we need the full URL including https://
  const backendUrl = process.env.BACKEND_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:5000";
  // Ensure we have the protocol
  const url = backendUrl.startsWith('http') ? backendUrl : `https://${backendUrl}`;
  return `${url}/api/auth/google/callback`;
};
const User = require("../models/User");

//Load environment variables
require("dotenv").config();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: getCallbackURL()
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        let user = await User.findOne({ googleId: profile.id });
        if (!user) {
          user = await User.create({
            googleId: profile.id,
            email,
            name: profile.displayName
          });
        }
        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  const user = await User.findById(id);
  done(null, user);
});

module.exports = passport;
