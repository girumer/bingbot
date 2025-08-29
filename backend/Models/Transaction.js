const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  transactionNumber: { type: String, required: true, unique: true },
  type: { type: String, enum: ["telebirr", "cbe"], required: true },
  amount: { type: Number, required: true },
  rawMessage: { type: String }, // optional: store the full message
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Transaction", transactionSchema);
