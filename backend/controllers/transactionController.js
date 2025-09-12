const BingoBord = require('../Models/BingoBord');
const Transaction = require("../Models/Transaction");

const Depoc=require('../Models/DepositSchema');

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
    let {message, phoneNumber, amount, type } = req.body;

    // Sanitize the input
    message = message ? message.trim() : null;
    phoneNumber = phoneNumber ? phoneNumber.trim() : null;
    amount = parseFloat(amount);
   const user = await BingoBord.findOne({ phoneNumber });
    if (!message) {
      return res.status(400).json({ error: "Message is required." });
    }
    if (!phoneNumber) {
      return res.status(400).json({ error: "Phone number is required." });
    }
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: "Valid amount is required." });
    }
    if (!type || !["telebirr", "cbebirr"].includes(type.toLowerCase())) {
      console.log(type);
      return res.status(400).json({ error: "Invalid or missing transaction type." });
    }
    // --- Step 1: Extract the transaction number from the user's message ---
   let transactionNumber;
    if (type.toLowerCase() === "telebirr") {
      const transMatch = message.match(/transaction number is\s*(\w+)/i);
      if (transMatch) transactionNumber = transMatch[1].trim();
    } else if (type.toLowerCase() === "cbebirr") {
      const transMatch = message.match(/Txn[:\s]+(\w+)/i);
      if (transMatch) transactionNumber = transMatch[1].trim();
    }
    
    if (!transactionNumber) {
      return res.status(400).json({ error: "Failed to extract transaction number from message." });
    }

     
    // Step 2: Find and update the pending transaction atomically.
    // This looks for a transaction with the specific number and a 'pending' status.
    // If it finds it, it will update the status to 'completed'.
    const updatedTx = await Transaction.findOne(
      { transactionNumber: transactionNumber},
      
   
    );
  

    if (!updatedTx) {
      // This will now catch two cases:
      // 1) The transaction number is not found at all.
      // 2) The transaction was found, but its status was not 'pending' (meaning it was already processed).
      return res.status(400).json({ error: "Invalid or already-claimed transaction number." });
    }

    // Find the user who is trying to deposit
   
    if (updatedTx.amount !== amount) {
      
      return res.status(400).json({ error: "Amount mismatch. Please check your deposit amount." });
    }
     if (updatedTx.type !== type) {
      
      return res.status(400).json({ error: "type  mismatch. Please check your deposit type." });
    }
 
 const counter = await Depoc.findOneAndUpdate(
          { _id: "depositId" },
          { $inc: { seq: 1 } },
          { new: true, upsert: true }
        );
        if (!counter) {
          return res.status(500).json({ message: "Failed to generate a unique withdrawal ID." });
        }
        const depositId = counter.seq;
    // Step 3: Credit the user's wallet.
    const bonus = updatedTx.amount * 0.10;
    const totalCredit = updatedTx.amount + bonus;
    user.Wallet += totalCredit;;
 
      await user.save();

       const newTx = new Transaction({
            transactionNumber: `WD${Date.now()}`,
            depositId,
            phoneNumber,
            method: "deposit",
            type,
            amount,
            rawMessage: `deposit  via ${type}`,
          });
    

    // Step 4: Save the user's updated wallet.
  
    await newTx.save();
     await Transaction.deleteOne({transactionNumber});
    console.log(`User wallet updated. New balance: ${user.Wallet}`);
   
    res.json({
    
      message: `Deposit of ${updatedTx.amount} ETB confirmed successfully! Your new wallet balance is ${user.Wallet}.`,
      wallet: user.Wallet,
    });

  } catch (err) {
    console.error("Deposit confirmation error:", err);
    res.status(500).json({ error: "cheak the amount u deposit." });
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
