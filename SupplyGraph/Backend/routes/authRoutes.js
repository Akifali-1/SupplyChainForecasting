const express = require("express");
const passport = require("passport");
const router = express.Router();
const { etagMiddleware } = require("../utils/etag");

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
    console.log('🔐 OAuth: Error param:', req.query.error);
    console.log('🔐 OAuth: Code param:', req.query.code ? 'present' : 'missing');
    
    if (req.query.error) {
      console.error('❌ OAuth Error from Google:', req.query.error, req.query.error_description);
      return res.redirect(`${FRONTEND_URL}/login?error=oauth_failed&details=${encodeURIComponent(req.query.error_description || req.query.error)}`);
    }
    
    passport.authenticate("google", { 
      failureRedirect: `${FRONTEND_URL}/login?error=oauth_failed`,
      session: true
    }, (err, user, info) => {
      if (err) {
        console.error('❌ OAuth Passport Error:', err);
        console.error('❌ Error stack:', err.stack);
        return res.redirect(`${FRONTEND_URL}/login?error=oauth_failed&details=${encodeURIComponent(err.message)}`);
      }
      
      if (!user) {
        console.error('❌ OAuth: No user returned from Passport');
        console.error('❌ Passport info:', info);
        return res.redirect(`${FRONTEND_URL}/login?error=oauth_failed`);
      }
      
      // Log in the user
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          console.error('❌ OAuth: Login error:', loginErr);
          return res.redirect(`${FRONTEND_URL}/login?error=oauth_failed&details=${encodeURIComponent(loginErr.message)}`);
        }
        
        // Success - redirect to frontend OAuth callback handler
        console.log('✅ OAuth: Success, redirecting to frontend');
        console.log('✅ OAuth: User:', user.email);
        res.redirect(`${FRONTEND_URL}/oauth/callback`);
      });
    })(req, res, next);
  }
);

// Logout
router.get("/logout", (req, res) => {
  req.logout(() => {
    res.json({ message: "Logged out" });
  });
});

// Get current user - ETag enabled (user data changes infrequently)
router.get("/me", etagMiddleware, (req, res) => {
  // Log session info for debugging
  console.log('🔐 /me endpoint called');
  console.log('🔐 Session ID:', req.sessionID);
  console.log('🔐 User:', req.user ? req.user.email : 'No user');
  console.log('🔐 Session exists:', !!req.session);
  res.json(req.user || null);
});

module.exports = router;
