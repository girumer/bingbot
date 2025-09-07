const express = require("express");
const router = express.Router();
const BingoBord = require("../Models/BingoBord");
const Transaction = require('../Models/Transaction');
// Deposit


// Withdraw

// Withdraw route
router.post("/withdraw", async (req, res) => {
  const { username, amount, phoneNumber,type } = req.body;

  try {
    const user = await BingoBord.findOne({ username });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
if (!type || !["telebirr", "cbebirr"].includes(type)) {
    return res.status(400).json({ message: "Valid type (telebirr/cbebirr) is required" });
  }
    if (user.Wallet < amount) {
      return res.status(400).json({ message: "Insufficient balance" });
    }

    // 1️⃣ Update wallet
    user.Wallet -= amount;

    // 2️⃣ Save in global Transaction collection
    try {
      const newTx = new Transaction({
        transactionNumber: `WD${Date.now()}`,
        phoneNumber,
        method: "withdrawal",
        type,
        amount,
        rawMessage: `Withdraw via ${type}`,
      });
      await newTx.save();
    } catch (txErr) {
      console.error("Error saving to global Transaction collection:", txErr);
      return res.status(500).json({ message: "Error saving global transaction. Please check the 'Transaction' model." });
    }

    try {
      // We are no longer saving a transaction to the user document.
      await user.save();
    } catch (userErr) {
      if (!type) {
  return res.status(400).json({ message: "Withdrawal type is required (telebirr or cbebirr)" });
}
      console.error("Error saving user document:", userErr);
      return res.status(500).json({ message: "Error saving user document. Please check the 'BingoBord' model." });
    }

    res.json({ message: "Withdrawal successful", wallet: user.Wallet });
  } catch (err) {
    console.error("General server error:", err);
    res.status(500).json({ message: "Server error occurred" });
  }
});


// Get transaction history
router.get("/history/:username", async (req, res) => {
  try {
    const user = await BingoBord.findOne({ username: req.params.username });
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user.transactions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error " });
  }
});
// Get all users' transactions (for admin dashboard)
router.get("/all", async (req, res) => {
  try {
    const users = await BingoBord.find({}, "username transactions");
    const allTransactions = users.map(u => ({
      username: u.username,
      transactions: u.transactions
    }));
    res.json(allTransactions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});
// Get paginated list of users (Admin only)
router.get("/admin-api/users", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const totalUsers = await BingoBord.countDocuments();
    const users = await BingoBord.find()
      .skip(skip)
      .limit(limit)
      .select("username phoneNumber Wallet"); // only send safe fields

    res.json({
      users,
      totalUsers,
      totalPages: Math.ceil(totalUsers / limit),
      currentPage: page,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
