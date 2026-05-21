const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Company = require("../models/Company");
const { requireAuth, requireRole } = require("../utils/auth");

// POST /api/company/setup - Admin sets their company name on first login
router.post("/setup", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const { companyName } = req.body;
    if (!companyName || !companyName.trim()) {
      return res.status(400).json({ error: "Company name is required" });
    }

    const company = await Company.findById(req.user.companyId);
    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }
    if (company.setupComplete) {
      return res.status(400).json({ error: "Company is already set up" });
    }

    company.name = companyName.trim();
    company.setupComplete = true;
    await company.save();

    console.log(`✅ Company setup complete: "${company.name}" (${company._id})`);
    res.json({ success: true, companyName: company.name });
  } catch (error) {
    res.status(500).json({ error: "Failed to save company name", details: error.message });
  }
});


// GET /api/company/members - Admin only, returns all users belonging to this admin's company
router.get("/members", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const companyId = req.user.companyId;
    if (!companyId) {
      return res.status(400).json({ error: "User is not linked to any company" });
    }

    const members = await User.find({ companyId })
      .select("_id name email role createdAt")
      .sort({ createdAt: 1 });

    res.json(members);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch company members", details: error.message });
  }
});

// DELETE /api/company/members/:userId - Admin only, removes a user from this company
router.delete("/members/:userId", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const { userId } = req.params;
    const companyId = req.user.companyId;

    if (userId === req.user._id.toString()) {
      return res.status(400).json({ error: "You cannot revoke your own admin access" });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!targetUser.companyId || targetUser.companyId.toString() !== companyId.toString()) {
      return res.status(403).json({ error: "You do not have permission to manage this user" });
    }

    await User.findByIdAndDelete(userId);

    res.json({ success: true, message: "User access revoked successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to revoke user access", details: error.message });
  }
});

module.exports = router;
