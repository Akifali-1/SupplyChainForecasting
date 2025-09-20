const express = require("express");
const passport = require("passport");
const router = express.Router();

// Start Google OAuth
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

// Callback after Google OAuth
router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "http://localhost:3000/login?error=oauth_failed" }),
  (req, res) => {
    // Redirect to frontend OAuth callback handler
    res.redirect("http://localhost:3000/oauth/callback");
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
