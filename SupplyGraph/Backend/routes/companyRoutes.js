const express = require("express");
const router = express.Router();
const { docClient, TABLE_NAME } = require("../config/dynamodb");
const { GetCommand, UpdateCommand, QueryCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const { requireAuth, requireRole } = require("../utils/auth");

// POST /api/company/setup - Admin sets their company name on first login
router.post("/setup", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const { companyName } = req.body;
    if (!companyName || !companyName.trim()) {
      return res.status(400).json({ error: "Company name is required" });
    }

    const companyKey = { PK: `COMPANY#${req.user.companyId}`, SK: "METADATA" };
    const compResult = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: companyKey
    }));
    const company = compResult.Item;
    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }
    if (company.setupComplete) {
      return res.status(400).json({ error: "Company is already set up" });
    }

    const nameTrimmed = companyName.trim();
    
    // Update company record
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: companyKey,
      UpdateExpression: "SET #n = :name, setupComplete = :trueVal, GSI1_PK = :gsiName, GSI1_SK = :meta",
      ExpressionAttributeNames: {
        "#n": "name"
      },
      ExpressionAttributeValues: {
        ":name": nameTrimmed,
        ":trueVal": true,
        ":gsiName": `COMPANY_NAME#${nameTrimmed.toLowerCase()}`,
        ":meta": "METADATA"
      }
    }));

    console.log(`✅ Company setup complete: "${nameTrimmed}" (${req.user.companyId})`);
    res.json({ success: true, companyName: nameTrimmed });
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

    // Query for all users under the company PK where SK starts with USER#
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
      ExpressionAttributeValues: {
        ":pk": `COMPANY#${companyId}`,
        ":skPrefix": "USER#"
      }
    }));

    const members = (result.Items || []).map(u => ({
      _id: u.userId,
      name: u.name,
      email: u.email,
      role: u.role || "user",
      createdAt: u.createdAt
    }));

    // Sort by createdAt ascending
    members.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

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

    if (userId === req.user.userId) {
      return res.status(400).json({ error: "You cannot revoke your own admin access" });
    }

    const targetUserResult = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `COMPANY#${companyId}`, SK: `USER#${userId}` }
    }));
    const targetUser = targetUserResult.Item;
    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!targetUser.companyId || targetUser.companyId !== companyId) {
      return res.status(403).json({ error: "You do not have permission to manage this user" });
    }

    // Delete the user record
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { PK: `COMPANY#${companyId}`, SK: `USER#${userId}` }
    }));

    // Delete the corresponding email lookup record
    if (targetUser.email) {
      await docClient.send(new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { PK: `COMPANY#${companyId}`, SK: `EMAIL#${targetUser.email.toLowerCase()}` }
      }));
    }

    res.json({ success: true, message: "User access revoked successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to revoke user access", details: error.message });
  }
});

module.exports = router;
