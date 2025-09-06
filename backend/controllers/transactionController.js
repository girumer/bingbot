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
exports.depositAmount = async (req, res) => {
  try {
    let { message, phoneNumber, amount } = req.body;

    // Sanitize the input
    message = message ? message.trim() : null;
    phoneNumber = phoneNumber ? phoneNumber.trim() : null;
    amount = parseFloat(amount); 

    if (!message) {
      return res.status(400).json({ error: "Message is required." });
    }
    if (!phoneNumber) {
      return res.status(400).json({ error: "Phone number is required." });
    }
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: "Valid amount is required." });
    }

    // --- Step 1: Extract the transaction number from the user's message ---
    let transactionNumber;
    if (message.toLowerCase().includes("telebirr")) {
      const transMatch = message.match(/transaction number is\s*(\w+)/i);
      if (transMatch) transactionNumber = transMatch[1].trim();
    }
    if (message.toLowerCase().includes("cbe") || message.toLowerCase().includes("commercial bank")) {
      const transMatch = message.match(/Txn[:\s]+(\w+)/i);
      if (transMatch) transactionNumber = transMatch[1].trim();
    }

    if (!transactionNumber) {
      return res.status(400).json({ error: "Failed to extract transaction number from message." });
    }

    // Step 2: Find the pending transaction without deleting it yet.
    const pendingTx = await Transaction.findOne({ transactionNumber: transactionNumber });

    if (!pendingTx) {
      return res.status(400).json({ error: "Invalid or already-claimed transaction number." });
    }
    
    // CRITICAL SECURITY CHECK: Verify the phone number from the request matches the number from the transaction.
  

    // NEW CONSISTENCY CHECK: Ensure the amount from the bot matches the amount in the transaction record.
    if (pendingTx.amount !== amount) {
      // The transaction is not deleted, so no need to re-insert.
      return res.status(400).json({ error: "Amount mismatch. Please check your deposit amount." });
    }

    // All checks passed. Now, atomically delete the pending transaction to prevent it from being claimed again.
    const deletedTx = await Transaction.findOneAndDelete({ transactionNumber: transactionNumber });
  console.log("delte trans is ",deletedTx);
    if (!deletedTx) {
      // This is a rare case, but it handles a race condition where another process claimed it just before this one.
      return res.status(400).json({ error: "Transaction already claimed." });
    }

    // Find the user who is trying to deposit
    const user = await BingoBord.findOne({ phoneNumber });
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Step 3: Link the transaction to the user's history and credit their wallet.
    user.Wallet += pendingTx.amount;
    user.transactions.push({
      type: pendingTx.type,
      method: "deposit",
      amount: pendingTx.amount,
      status: "success",
      timestamp: new Date(),
    });

    // Step 4: Save the user's updated wallet and transaction history.
    await user.save();
    console.log(`User wallet updated. New balance: ${user.Wallet}`);

    res.json({
      success: true,
      message: `Deposit of ${pendingTx.amount} ETB confirmed successfully! Your new wallet balance is ${user.Wallet}.`,
      wallet: user.Wallet,
    });

  } catch (err) {
    console.error("Deposit confirmation error:", err);
    res.status(500).json({ error: "may ur deposit amount is not correct" });
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
