const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const Invite = require("../models/Invite");
const Company = require("../models/Company");
const { requireAuth, requireRole } = require("../utils/auth");

// POST /api/invite/generate - Admin only, generates a new invite link
router.post("/generate", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const companyId = req.user.companyId;
    if (!companyId) {
      return res.status(400).json({ error: "User is not linked to any company" });
    }

    // Generate unique random token
    const token = crypto.randomBytes(16).toString("hex");
    
    // Set expiry to 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invite = new Invite({
      token,
      companyId,
      createdBy: req.user._id,
      expiresAt
    });

    await invite.save();

    res.json({ token, expiresAt });
  } catch (error) {
    res.status(500).json({ error: "Failed to generate invite token", details: error.message });
  }
});

// GET /api/invite/verify/:token - Public, validates token and caches in session
router.get("/verify/:token", async (req, res) => {
  try {
    const { token } = req.params;

    const invite = await Invite.findOne({ token });
    if (!invite) {
      return res.status(404).json({ error: "This invitation link has expired or is invalid. Please contact your administrator for a new link." });
    }

    if (invite.used) {
      return res.status(400).json({ error: "This invitation link has already been used. Please contact your administrator for a new link." });
    }

    if (new Date() > invite.expiresAt) {
      return res.status(400).json({ error: "This invitation link has expired. Please contact your administrator for a new link." });
    }

    const company = await Company.findById(invite.companyId);
    if (!company) {
      return res.status(404).json({ error: "Company associated with this invitation was not found." });
    }

    // Store token in session to use post-auth in OAuth callback
    req.session.inviteToken = token;
    
    // Explicitly save session
    req.session.save((err) => {
      if (err) {
        return res.status(500).json({ error: "Session save failed" });
      }
      res.json({ success: true, companyName: company.name, companyId: company._id });
    });
  } catch (error) {
    res.status(500).json({ error: "Token verification failed", details: error.message });
  }
});

module.exports = router;
