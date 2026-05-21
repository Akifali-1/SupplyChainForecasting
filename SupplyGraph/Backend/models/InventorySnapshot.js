const mongoose = require("mongoose");

const inventoryItemSchema = new mongoose.Schema({
  product_id:     { type: String, required: true },
  current_stock:  { type: Number, required: true, min: 0 },
  lead_time_days: { type: Number, default: 5, min: 0 },
  safety_stock:   { type: Number, default: 0, min: 0 },
  unit_cost:      { type: Number, default: 0, min: 0 },
}, { _id: false });

const inventorySnapshotSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    required: true,
    unique: true,     // one snapshot doc per company (upserted on upload)
  },
  items: [inventoryItemSchema],
  uploadedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("InventorySnapshot", inventorySnapshotSchema);
