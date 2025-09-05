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
    const { message, phoneNumber } = req.body;
    if (!message) return res.status(400).json({ error: "Message is required" });

    const user = await BingoBord.findOne({ phoneNumber });
    if (!user) return res.status(404).json({ error: "User not found" });

    // Step 1: Parse transactions from message
    let transactions = [];
    if (message.toLowerCase().includes("telebirr")) {
      transactions = parseTelebirrMessage(message); // your parser
    } else if (message.toLowerCase().includes("cbe") || message.toLowerCase().includes("commercial bank")) {
      transactions = parseCBEMessages(message); // your parser
    }

    if (transactions.length === 0) {
      return res.status(404).json({ error: "No valid transactions found" });
    }

    // Step 2: Deposit amounts
    let totalDeposited = 0;
    for (const tx of transactions) {
      const txInDb = await Transaction.findOne({ transactionNumber: tx.transactionNumber });
      if (!txInDb) continue;

      user.Wallet += txInDb.amount;
      totalDeposited += txInDb.amount;
      await Transaction.deleteOne({ _id: txInDb._id });
    }

    await user.save();

    if (totalDeposited === 0) {
      return res.status(404).json({ error: "No new transactions to deposit" });
    }

    res.json({ success: true, message: `Deposited total of ${totalDeposited} ETB to ${user.username}` });

  } catch (err) {
    console.error(err);
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
