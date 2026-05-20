const mongoose = require("mongoose");

const inviteSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  expiresAt: { type: Date, required: true },
  used: { type: Boolean, default: false }
});

module.exports = mongoose.model("Invite", inviteSchema);
