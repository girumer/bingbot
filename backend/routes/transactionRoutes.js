const express = require("express");
const router = express.Router();
const BingoBord = require("../Models/BingoBord");

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
router.post("/withdraw", async (req, res) => {
  const { username, amount, method } = req.body;

  try {
    const user = await BingoBord.findOne({ username });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.Wallet < amount) {
      return res.status(400).json({ message: "Insufficient balance" });
    }

    user.Wallet -= amount;
    user.transactions.push({
      type: "withdraw",
      method,
      amount,
      status: "success",
    });
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

module.exports = router;
