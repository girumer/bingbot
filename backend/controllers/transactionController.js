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

    // Check which type of message it is and call the appropriate parser
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

    // --- FIX: Add the required 'method' field to each transaction ---
    const transactionsToSave = transactions.map(tx => {
      // Create a new object with all the existing properties from `tx`
      // and add the `method` field which is required by your model.
      return {
        ...tx,
        method: "depositpend"
      };
    });

    // Save each transaction to DB
    const savedTransactions = [];
    for (const tx of transactionsToSave) {
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
    let { message, phoneNumber } = req.body;

    // Sanitize the input
    message = message ? message.trim() : null;
    phoneNumber = phoneNumber ? phoneNumber.trim() : null;

    if (!message) {
      return res.status(400).json({ error: "Message is required." });
    }
    if (!phoneNumber) {
      return res.status(400).json({ error: "Phone number is required." });
    }

    // --- Step 1: Find the user first. We cannot proceed without a valid user. ---
    const user = await BingoBord.findOne({ phoneNumber });
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // --- Step 2: Extract the transaction number, amount, and method from the message ---
    let transactionNumber;
    let amountFromMessage;
    let method;
    let type;

    if (message.toLowerCase().includes("telebirr")) {
      const transMatch = message.match(/transaction number is\s*(\w+)/i);
      if (transMatch) transactionNumber = transMatch[1].trim();

      const amountMatch = message.match(/ETB\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i);
      if (amountMatch) {
        amountFromMessage = parseFloat(amountMatch[1].replace(/,/g, ''));
      }
      method = "deposit";
      type = "telebirr";
    } else if (message.toLowerCase().includes("cbe") || message.toLowerCase().includes("commercial bank")) {
      const transMatch = message.match(/Txn[:\s]+(\w+)/i);
      if (transMatch) transactionNumber = transMatch[1].trim();

      const amountMatch = message.match(/ETB\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i);
      if (amountMatch) {
        amountFromMessage = parseFloat(amountMatch[1].replace(/,/g, ''));
      }
      method = "deposit";
      type = "cbebirr";
    }

    if (!transactionNumber) {
      return res.status(400).json({ error: "Failed to extract a valid transaction number from the message." });
    }
    if (isNaN(amountFromMessage) || amountFromMessage <= 0) {
      return res.status(400).json({ error: "Failed to extract a valid amount from the message." });
    }

    // --- Step 3: Create and save the new transaction document ---
    const newTransaction = new Transaction({
      transactionNumber: transactionNumber,
      phoneNumber: user.phoneNumber,
      method: method,
      amount: amountFromMessage,
      type: type,
      rawMessage: message,
      status: "completed", // Since it's confirmed, the status is 'completed'
    });

    try {
      await newTransaction.save();
    } catch (saveError) {
      if (saveError.code === 11000) {
        // Handle duplicate key error for transactionNumber
        return res.status(400).json({ error: "This transaction number has already been claimed." });
      }
      throw saveError; // Re-throw other errors
    }

    // --- Step 4: Update the user's wallet ---
    user.Wallet += amountFromMessage;
    await user.save();
    console.log(`User wallet updated. New balance: ${user.Wallet}`);

    res.json({
      success: true,
      message: `Deposit of ${amountFromMessage} ETB confirmed successfully! Your new wallet balance is ${user.Wallet}.`,
      wallet: user.Wallet,
    });

  } catch (err) {
    console.error("Deposit confirmation error:", err);
    res.status(500).json({ error: "An internal server error occurred. Please try again later." });
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
