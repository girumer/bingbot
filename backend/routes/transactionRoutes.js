const express = require("express");
const router = express.Router();
const BingoBord = require("../Models/BingoBord");
const Transaction = require('../Models/Transaction');
// Deposit
router.post("/deposit", async (req, res) => {
  const { username, amount, method } = req.body;

  try {
    const user = await BingoBord.findOne({ username });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Update wallet & add transaction
    user.Wallet += amount;
    user.transactions.push({
      type: "deposit",
      method,
      phoneNumber,
      amount,
      status: "success",
    });
    await user.save();

    res.json({ message: "Deposit successful", wallet: user.Wallet });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Withdraw

// Withdraw route
router.post("/withdraw", async (req, res) => {
  const { username, amount, phoneNumber, method } = req.body;

  try {
    const user = await BingoBord.findOne({ username });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.Wallet < amount) {
      return res.status(400).json({ message: "Insufficient balance" });
    }

    // 1️⃣ Update wallet
    user.Wallet -= amount;

    // 2️⃣ Save in user's transaction history
    user.transactions.push({
      type: "withdraw",       // ✅ matches BingoBord schema
      method,                 // ✅ "telebirr" or "cbebirr"
      amount,
      status: "success"
    });

    // 3️⃣ Save in global Transaction collection
    const newTx = new Transaction({
      transactionNumber: `WD${Date.now()}`,
      phoneNumber,
      type: method === "telebirr" ? "telebirr" : "cbe", // ✅ matches Transaction schema
      amount,
      rawMessage: `Withdraw via ${method}`
    });
    await newTx.save();

    await user.save();

    res.json({ message: "Withdrawal successful", wallet: user.Wallet });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
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
    res.status(500).json({ message: "Server error" });
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
