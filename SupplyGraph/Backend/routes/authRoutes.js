const express = require("express");
const passport = require("passport");
const router = express.Router();

// Get frontend URL from environment
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// Start Google OAuth
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

// Callback after Google OAuth
router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: `${FRONTEND_URL}/login?error=oauth_failed` }),
  (req, res) => {
    // Redirect to frontend OAuth callback handler
    res.redirect(`${FRONTEND_URL}/oauth/callback`);
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
  res.json(req.user || null);
});

module.exports = router;
