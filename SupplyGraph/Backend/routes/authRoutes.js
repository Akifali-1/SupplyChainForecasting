const express = require("express");
const passport = require("passport");
const router = express.Router();
const { etagMiddleware } = require("../utils/etag");

// Get frontend URL from environment
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// Start Google OAuth
router.get("/google", (req, res, next) => {
  console.log('🔐 OAuth: Initiating Google login');
  
  // Dynamic frontendUrl capture from query or referer
  let frontendUrl = req.query.frontendUrl;
  if (!frontendUrl && req.headers.referer) {
    try {
      const parsedReferer = new URL(req.headers.referer);
      frontendUrl = parsedReferer.origin;
    } catch (e) {
      // Ignore URL parsing errors
    }
  }

  const targetFrontendUrl = frontendUrl || FRONTEND_URL;
  let callbackURL;
  try {
    const originUrl = new URL(targetFrontendUrl);
    if (originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1') {
      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      callbackURL = `${protocol}://${host}/api/auth/google/callback`;
    } else {
      callbackURL = `${originUrl.origin}/api/auth/google/callback`;
    }
  } catch (e) {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    callbackURL = `${protocol}://${host}/api/auth/google/callback`;
  }

  console.log('🔐 OAuth: Dynamic Callback URL being sent to Google:', callbackURL);

  req.session.frontendUrl = targetFrontendUrl;
  req.session.save((err) => {
    if (err) console.error('🔐 OAuth: Error saving session with frontendUrl:', err);
    passport.authenticate("google", { 
      scope: ["profile", "email"],
      callbackURL: callbackURL
    })(req, res, next);
  });
});

// Callback after Google OAuth
router.get(
  "/google/callback",
  (req, res, next) => {
    console.log('🔐 OAuth: Callback received');
    console.log('🔐 OAuth: Query params:', req.query);
    console.log('🔐 OAuth: Error param:', req.query.error);
    console.log('🔐 OAuth: Code param:', req.query.code ? 'present' : 'missing');
    
    const targetFrontendUrl = req.session.frontendUrl || FRONTEND_URL;
    console.log('🔐 OAuth: Target Frontend URL for redirections:', targetFrontendUrl);

    let callbackURL;
    try {
      const originUrl = new URL(targetFrontendUrl);
      if (originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1') {
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.headers['x-forwarded-host'] || req.headers.host;
        callbackURL = `${protocol}://${host}/api/auth/google/callback`;
      } else {
        callbackURL = `${originUrl.origin}/api/auth/google/callback`;
      }
    } catch (e) {
      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      callbackURL = `${protocol}://${host}/api/auth/google/callback`;
    }

    console.log('🔐 OAuth: Dynamic Callback URL for validation:', callbackURL);

    if (req.query.error) {
      console.error('❌ OAuth Error from Google:', req.query.error, req.query.error_description);
      return res.redirect(`${targetFrontendUrl}/login?error=oauth_failed&details=${encodeURIComponent(req.query.error_description || req.query.error)}`);
    }
    
    passport.authenticate("google", { 
      failureRedirect: `${targetFrontendUrl}/login?error=oauth_failed`,
      session: true,
      callbackURL: callbackURL
    }, (err, user, info) => {
      if (err) {
        console.error('❌ OAuth Passport Error:', err);
        console.error('❌ Error stack:', err.stack);
        return res.redirect(`${targetFrontendUrl}/login?error=oauth_failed&details=${encodeURIComponent(err.message)}`);
      }
      
      if (!user) {
        console.error('❌ OAuth: No user returned from Passport');
        console.error('❌ Passport info:', info);
        return res.redirect(`${targetFrontendUrl}/login?error=oauth_failed`);
      }
      
      // Log in the user
      req.logIn(user, async (loginErr) => {
        if (loginErr) {
          console.error('❌ OAuth: Login error:', loginErr);
          return res.redirect(`${targetFrontendUrl}/login?error=oauth_failed&details=${encodeURIComponent(loginErr.message)}`);
        }
        
        // Success — redirect to setup-company if first-time admin, otherwise dashboard
        console.log('✅ OAuth: Success, redirecting to frontend');
        console.log('✅ OAuth: User:', user.email);
        const Company = require('../models/Company');
        const company = user.companyId ? await Company.findById(user.companyId) : null;
        const needsSetup = company && !company.setupComplete;
        
        // Clean up from session
        delete req.session.frontendUrl;
        
        res.redirect(`${targetFrontendUrl}${needsSetup ? '/setup-company' : '/oauth/callback'}`);
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
router.get("/me", etagMiddleware, async (req, res) => {
  // Log session info for debugging
  console.log('🔐 /me endpoint called');
  console.log('🔐 Session ID:', req.sessionID);
  console.log('🔐 User:', req.user ? req.user.email : 'No user');
  console.log('🔐 Session exists:', !!req.session);
  
  if (!req.user) {
    return res.json(null);
  }

  try {
    const User = require("../models/User");
    const Company = require("../models/Company");
    const userObj = await User.findById(req.user._id).populate("companyId");
    if (!userObj) {
      return res.json(null);
    }

    const company = userObj.companyId;
    const needsSetup = company && !company.setupComplete;
    
    res.json({
      _id: userObj._id,
      googleId: userObj.googleId,
      email: userObj.email,
      name: userObj.name,
      role: userObj.role || "user",
      companyId: company ? company._id : null,
      companyName: company ? company.name : null,
      needsSetup: !!needsSetup,
      createdAt: userObj.createdAt
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ error: "Failed to get user profile" });
  }
});

module.exports = router;
