const mongoose = require("mongoose");

const companySchema = new mongoose.Schema({
  name: String,
  status: { type: String, default: "pending" }, // pending, training, completed
  files: {
    nodes: { type: String, default: null },
    edges: { type: String, default: null },
    demand: { type: String, default: null },
    model: { type: String, default: null }
  }
});

module.exports = mongoose.model("Company", companySchema);
