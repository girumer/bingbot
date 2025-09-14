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
// utils/messageParsers.js



// In your utils/messageParsers.js file
// In your utils/messageParsers.js file or where the function is located
function parseCBEMessages(message) {
    const transactions = [];
    const amountRegex = /([\d,]+\.\d+)\s*(?:Br\.|ብር)/i;
    const transactionNumberRegex = /በደረሰኝ ቁ?ጠ?ር\s+([a-zA-Z0-9]+)/i;

    const amountMatch = message.match(amountRegex);
    const txNumberMatch = message.match(transactionNumberRegex);

    if (amountMatch && txNumberMatch) {
        const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
        const transactionNumber = txNumberMatch[1];
        
        if (!isNaN(amount) && transactionNumber) {
            transactions.push({
                transactionNumber,
                amount,
                phoneNumber: undefined, // <-- Change this from null to undefined
                type: 'cbebirr' 
            });
        }
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
            // This is the new part: return a clear error to the client
            return res.status(409).json({ error: "Transaction already exists." });}
             else {
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
// Add this constant at the top of your file for easy modification
 // 10% bonus
// Add this constant at the top of your file for easy modification
const REFERRAL_BONUS_PERCENTAGE = 0.10; // 10% bonus
const isAmountMismatch = (dbAmount, requestAmount) => {
  return parseFloat(dbAmount) !== parseFloat(requestAmount);
};


exports.depositAmount = async (req, res) => {
    try {
        let { message, phoneNumber, amount, type } = req.body;
        message = message ? message.trim() : null;
        phoneNumber = phoneNumber ? phoneNumber.trim() : null;
        amount = parseFloat(amount);
        const user = await BingoBord.findOne({ phoneNumber });
        if (!message || !phoneNumber || isNaN(amount) || amount <= 0 || !type || !["telebirr", "cbebirr"].includes(type.toLowerCase())) {
            return res.status(400).json({ error: "Invalid or missing parameters." });
        }
        if (!user) {
            console.error(`User not found for phone number: ${phoneNumber}`);
            return res.status(404).json({ error: "User not found. Please register or provide a valid phone number." });
        }
        
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
        
        // Step 1: Find the PENDING transaction. This is the crucial security check.
        const updatedTx = await Transaction.findOne({
            transactionNumber: transactionNumber,
            method: "depositpend" // This ensures it can't be claimed twice
        });
        
        // If the transaction is not found, it has already been claimed or does not exist.
        if (!updatedTx) {
            return res.status(400).json({ error: "Invalid or already-claimed transaction number." });
        }

        // Step 2: Perform all necessary checks BEFORE processing the transaction.
        if (parseFloat(updatedTx.amount) !== amount) {
            return res.status(400).json({ error: "Amount mismatch. Please check your deposit amount." });
        }
        if (updatedTx.type !== type) {
            return res.status(400).json({ error: "type mismatch. Please check your deposit type." });
        }

        // Step 3: Update user's wallet and handle referral logic
        user.Wallet += updatedTx.amount;
        if (user.referredBy) {
            const referrer = await BingoBord.findOne({ telegramId: user.referredBy });
            if (referrer) {
                const referralBonus = amount * REFERRAL_BONUS_PERCENTAGE;
                referrer.Wallet += referralBonus;
                await referrer.save();
                const referralBonusTx = new Transaction({
                    transactionNumber: `REF${Date.now()}${referrer.telegramId}`,
                    phoneNumber: referrer.phoneNumber, 
                    method: "referral_bonus",
                    type: "bonus",
                    amount: referralBonus,
                    rawMessage: `Referral bonus from a new user's first deposit (${user.username})`,
                });
                await referralBonusTx.save();
                user.referralBonusPaid = true;
            }
        }
        await user.save();

        // Step 4: Delete the pending transaction.
        // This ensures it can never be used again and cleans your database.
        await Transaction.deleteOne({ transactionNumber: transactionNumber });

        console.log(`User wallet updated. New balance: ${user.Wallet}`);
        
        res.json({
            message: `Deposit of ${updatedTx.amount} ETB confirmed successfully! Your new wallet balance is ${user.Wallet}.`,
            wallet: user.Wallet,
        });

    } catch (err) {
        console.error("Deposit confirmation error:", err);
        res.status(500).json({ error: "check the amount you deposit." });
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
