const BingoBord = require('../Models/BingoBord');
const Transaction = require("../Models/Transaction");



// Utility function to parse Telebirr messages
function parseTelebirrMessage(message) {
  const transactions = [];

  const amountMatches = [...message.matchAll(/ETB\s*([\d,.]+(?:\.\d{2})?)/gi)];
  const transMatches = [...message.matchAll(/transaction number\s*is\s*([A-Z0-9]+)/gi)];

  for (let i = 0; i < Math.min(amountMatches.length, transMatches.length); i++) {
    const amount = parseFloat(amountMatches[i][1].replace(/,/g, ""));
    const transactionNumber = transMatches[i][1].trim();

    transactions.push({ type: "telebirr", amount, transactionNumber });
  }

  return transactions;
}

// Utility function to parse CBE messages (you can expand if needed)
function parseCBEMessages(message) {
  const transactions = [];

  const amountMatches = [...message.matchAll(/ETB\s*([\d,]+\.\d{2})/gi)];
  const transMatches = [...message.matchAll(/Txn[:\s]+(\w+)/gi)];

  for (let i = 0; i < Math.min(amountMatches.length, transMatches.length); i++) {
    const amount = parseFloat(amountMatches[i][1].replace(/,/g, ""));
    const transactionNumber = transMatches[i][1].trim();

    transactions.push({ type: "cbe", amount, transactionNumber });
  }

  return transactions;
}

exports.parseTransaction = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "Message is required" });

    let transactions = [];

    if (message.toLowerCase().includes("telebirr")) {
      transactions = parseTelebirrMessage(message);
    } else if (message.toLowerCase().includes("cbe") || message.toLowerCase().includes("commercial bank")) {
      transactions = parseCBEMessages(message);
    } else {
      return res.status(400).json({ error: "Unsupported transaction type" });
    }

    if (transactions.length === 0) {
      return res.status(400).json({ error: "No transaction found in message" });
    }

    // Save each transaction to DB
    const savedTransactions = [];
    for (const tx of transactions) {
      try {
        const newTx = new Transaction(tx);
        await newTx.save();
        savedTransactions.push(newTx);
      } catch (e) {
        if (e.code === 11000) {
          console.log(`Transaction ${tx.transactionNumber} already exists. Skipping.`);
        } else {
          console.error("Error saving transaction:", e);
        }
      }
    }

    res.json({ success: true, transactions: savedTransactions });

  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Server error" });
  }
};
// This function needs to be rewritten to handle the new flow
exports.depositAmount = async (req, res) => {
    try {
        // Assume the user sends the transaction number, not the full message
        const { transactionNumber, phoneNumber } = req.body; 

        if (!transactionNumber) {
            return res.status(400).json({ error: "Transaction number is required." });
        }
        if (!phoneNumber) {
            return res.status(400).json({ error: "Phone number is required." });
        }

        // Find the user who is trying to deposit
        const user = await BingoBord.findOne({ phoneNumber });
        if (!user) {
            return res.status(404).json({ error: "User not found." });
        }

        // Step 1: Find the transaction in the pending list.
        const pendingTx = await Transaction.findOne({ transactionNumber: transactionNumber });
       console.log("pending transaction is ",pendingTx);
        // Step 2: Check if the transaction exists and hasn't been used.
        if (!pendingTx) {
            return res.status(400).json({ error: "Invalid or already-claimed transaction number." });
        }

        // Step 3: Link the transaction to the user's history and credit their wallet.
        user.Wallet += pendingTx.amount;
        user.transactions.push({
            type: "deposit",
            method: pendingTx.type === "telebirr" ? "telebirr" : "cbebirr",
            amount: pendingTx.amount,
            status: "success",
            timestamp: new Date(),
        });

        // Step 4: Remove the transaction from the pending list to prevent double-spending.
        await Transaction.deleteOne({ _id: pendingTx._id });

        // Step 5: Save the user's updated wallet and transaction history.
        await user.save();

        res.json({
            success: true,
            message: `Deposit of ${pendingTx.amount} ETB confirmed successfully! Your new wallet balance is ${user.Wallet}.`,
            wallet: user.Wallet,
        });

    } catch (err) {
        console.error("Deposit confirmation error:", err);
        res.status(500).json({ error: "Server error" });
    }
};



// Get all pending transactions
exports.getPendingTransactions = async (req, res) => {
  try {
    // You can add filters if needed, e.g., by type or date
    const transactions = await Transaction.find({});
    res.json({ success: true, transactions });
    console.log("transaction append sucessfuly");
  } catch (err) {
    console.error("Error fetching pending transactions:", err);
    res.status(500).json({ error: "Server error" });
  }
};
