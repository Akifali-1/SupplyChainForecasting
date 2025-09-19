const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  googleId: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  name: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("User", userSchema);
