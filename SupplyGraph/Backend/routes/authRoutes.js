const express = require("express");
const passport = require("passport");
const router = express.Router();

// Get frontend URL from environment
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// Start Google OAuth
router.get("/google", (req, res, next) => {
  console.log('🔐 OAuth: Initiating Google login');
  console.log('🔐 OAuth: Frontend URL:', FRONTEND_URL);
  passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
});

// Callback after Google OAuth
router.get(
  "/google/callback",
  (req, res, next) => {
    console.log('🔐 OAuth: Callback received');
    console.log('🔐 OAuth: Query params:', req.query);
    
    passport.authenticate("google", { 
      failureRedirect: `${FRONTEND_URL}/login?error=oauth_failed`,
      session: true
    })(req, res, (err) => {
      if (err) {
        console.error('❌ OAuth Error:', err);
        return res.redirect(`${FRONTEND_URL}/login?error=oauth_failed&details=${encodeURIComponent(err.message)}`);
      }
      
      // Success - redirect to frontend OAuth callback handler
      console.log('✅ OAuth: Success, redirecting to frontend');
      console.log('✅ OAuth: User:', req.user ? req.user.email : 'No user');
      res.redirect(`${FRONTEND_URL}/oauth/callback`);
    });
  }
);

// Logout
router.get("/logout", (req, res) => {
  req.logout(() => {
    res.json({ message: "Logged out" });
  });
});

// Get current user
router.get("/me", (req, res) => {
  // Log session info for debugging
  if (process.env.NODE_ENV !== 'production' || process.env.ML_DEBUG === '1') {
    console.log('🔐 /me endpoint called');
    console.log('🔐 Session ID:', req.sessionID);
    console.log('🔐 User:', req.user ? req.user.email : 'No user');
    console.log('🔐 Session exists:', !!req.session);
  }
  res.json(req.user || null);
});

module.exports = router;
