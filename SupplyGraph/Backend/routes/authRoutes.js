const express = require("express");
const passport = require("passport");
const router = express.Router();

// Start Google OAuth
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

// Callback after Google OAuth
router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  (req, res) => {
    // Redirect to frontend with session
    res.redirect("http://localhost:3000");
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
