const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const { docClient, TABLE_NAME } = require("../config/dynamodb");
const { PutCommand, QueryCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
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

    // Save invite to DynamoDB
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `COMPANY#${companyId}`,
        SK: `INVITE#${token}`,
        GSI1_PK: `INVITE#${token}`,
        GSI1_SK: "METADATA",
        token,
        companyId,
        createdBy: req.user.userId,
        expiresAt: expiresAt.toISOString(),
        used: false
      }
    }));

    res.json({ token, expiresAt: expiresAt.toISOString() });
  } catch (error) {
    res.status(500).json({ error: "Failed to generate invite token", details: error.message });
  }
});

// GET /api/invite/verify/:token - Public, validates token and caches in session
router.get("/verify/:token", async (req, res) => {
  try {
    const { token } = req.params;

    // Retrieve invite via GSI1 query
    const inviteResult = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1_PK = :inv AND GSI1_SK = :meta",
      ExpressionAttributeValues: {
        ":inv": `INVITE#${token}`,
        ":meta": "METADATA"
      }
    }));
    const invite = inviteResult.Items && inviteResult.Items.length > 0 ? inviteResult.Items[0] : null;

    if (!invite) {
      return res.status(404).json({ error: "This invitation link has expired or is invalid. Please contact your administrator for a new link." });
    }

    if (invite.used) {
      return res.status(400).json({ error: "This invitation link has already been used. Please contact your administrator for a new link." });
    }

    if (new Date() > new Date(invite.expiresAt)) {
      return res.status(400).json({ error: "This invitation link has expired. Please contact your administrator for a new link." });
    }

    // Retrieve company
    const companyResult = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `COMPANY#${invite.companyId}`, SK: "METADATA" }
    }));
    const company = companyResult.Item;
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
      res.json({ success: true, companyName: company.name, companyId: company.companyId });
    });
  } catch (error) {
    res.status(500).json({ error: "Token verification failed", details: error.message });
  }
});

module.exports = router;
