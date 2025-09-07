const mongoose = require("mongoose");
const transactionSchema = new mongoose.Schema({
  transactionNumber: { type: String, required: true, unique: true },
  phoneNumber: { type: String, required: true, default: "UNKNOWN" },
  method: { type: String, enum: ["deposit", "withdrawal","depositpend"], required: true },
  amount: { type: Number, required: true },
  type: { type: String, enum: ["telebirr", "cbebirr"], required: true },
  rawMessage: { type: String },
  status: { type: String, enum: ["pending", "completed", "failed"], default: "pending" },
  createdAt: { type: Date, default: Date.now },
})

module.exports = mongoose.model("Transaction", transactionSchema);
