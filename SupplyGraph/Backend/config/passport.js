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
const Company = require("../models/Company");
const Invite = require("../models/Invite");

// Validate OAuth credentials
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.warn('⚠️  WARNING: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set. OAuth will not work.');
}

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: getCallbackURL(),
      passReqToCallback: true
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        if (!profile || !profile.emails || !profile.emails[0]) {
          console.error('❌ OAuth Error: No email in profile', profile);
          return done(new Error('No email found in Google profile'), null);
        }

        const email = profile.emails[0].value;
        // Search by googleId first, fallback to email to support any pre-existing manual creations
        let user = await User.findOne({ $or: [{ googleId: profile.id }, { email }] });

        if (!user) {
          let companyId = null;
          let role = "user";

          const inviteToken = req.session && req.session.inviteToken;
          if (inviteToken) {
            console.log('🔗 Found invite token in session:', inviteToken);
            const invite = await Invite.findOne({ 
              token: inviteToken, 
              used: false, 
              expiresAt: { $gt: new Date() } 
            });

            if (invite) {
              companyId = invite.companyId;
              role = "user";
              
              // Mark the invite as used
              invite.used = true;
              await invite.save();
              console.log(`✅ Joined existing company ${companyId} via invite link`);
            } else {
              console.warn('⚠️ Invite token found but is invalid or expired. Falling back to new company creation.');
            }
            
            // Clean up session token
            delete req.session.inviteToken;
          }

          // If not joining via invite, create a blank company shell and mark as admin
          if (!companyId) {
            const company = await Company.create({ setupComplete: false });
            companyId = company._id;
            role = "admin";
            console.log(`🏢 Created blank company shell (ID: ${companyId}) — admin must complete setup`);
          }

          user = await User.create({
            googleId: profile.id,
            email,
            name: profile.displayName,
            role,
            companyId
          });
          console.log('✅ New user created via OAuth:', email, 'Role:', role);
        } else {
          // User exists, if they don't have googleId yet, update it
          if (!user.googleId) {
            user.googleId = profile.id;
            await user.save();
          }
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
  // Store the MongoDB _id as a string in the session
  done(null, user._id.toString());
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    if (!user) {
      console.error("❌ Deserialize failed: user not found for id", id);
    }
    done(null, user);
  } catch (err) {
    console.error("❌ Deserialize user error:", err);
    done(err, null);
  }
});

module.exports = passport;
