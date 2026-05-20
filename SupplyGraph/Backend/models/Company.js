const mongoose = require("mongoose");

const companySchema = new mongoose.Schema({
  name: { type: String, default: null },
  setupComplete: { type: Boolean, default: false },
  status: { type: String, default: "new" },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Company", companySchema);

