const express = require("express");
const router = express.Router();
const BingoBord = require("../Models/BingoBord"); // adjust path if your model is elsewhere

/* router.post("/api/saveHistory", async (req, res) => {
  const { username, roomId, stake, outcome } = req.body;

  if (!username || !roomId || !stake || !outcome) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const user = await BingoBord.findOne({ username });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    user.gameHistory.push({
      gameId,
      roomId,
      stake,
      outcome,
      timestamp: new Date(),
    });

    if (outcome === "win") user.Wallet += stake;
    if (outcome === "loss") user.Wallet -= stake;

    await user.save();

    res.json({ success: true, gameHistory: user.gameHistory, Wallet: user.Wallet });
  } catch (err) {
    console.error("Failed to save game history:", err);
    res.status(500).json({ error: "Server error" });
  }
}); */

module.exports = router;
