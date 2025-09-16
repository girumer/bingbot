const BingoBord = require('../Models/BingoBord');
const Transaction = require("../Models/Transaction");

const Depoc=require('../Models/DepositSchema');
 
// Utility function to parse Telebirr messages
// Corrected parseTelebirrMessage function
const parseTelebirrMessage = (message) => {
    const transactions = [];
    // This regex looks for "received ETB [amount] from [sender]..."
    const amountAndSenderRegex = /received ETB\s*([\d,\.]+)\s*from\s*([a-zA-Z\s]+?)\s*\(\d{12}\)/i;
    
    // This regex looks for "Your transaction number is [transaction number]..."
    // It captures the transaction number exactly as it is, without changing case.
    const txNumberRegex = /Your transaction number is\s*([a-zA-Z0-9]+)/;
    
    const amountMatch = message.match(amountAndSenderRegex);
    const txNumberMatch = message.match(txNumberRegex);
    
    // Ensure both patterns are found before proceeding
    if (amountMatch && txNumberMatch) {
        // Extracting data from the matches
        const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
        const sender = amountMatch[2].trim();
        const transactionNumber = txNumberMatch[1];
        
        transactions.push({
            transactionNumber: transactionNumber, // This is now case-sensitive
            amount: amount,
            sender: sender,
            timestamp: new Date()
        });
    }
    
    return transactions;
};

// Utility function to parse CBE messages (you can expand if needed)
// utils/messageParsers.js



// In your utils/messageParsers.js file
// In your utils/messageParsers.js file or where the function is located
function parseCBEMessages(message) {
    const transactions = [];
    const lowerCaseMessage = message.toLowerCase();
    
    // Regex to find the amount and currency.
    const amountMatches = [...message.matchAll(/([\d,]+\.\d+)\s*(?:br\.|ብር)/gi)];

    // Corrected regex for CBE that handles the multiple Amharic characters
    const transMatches = [...lowerCaseMessage.matchAll(/(?:በደረሰኝ ቁ[ጠጥ]?ር|txn id|by receipt number)\s*([a-zA-Z0-9]+)/gi)];

    // This loop ensures that we only process a transaction if both parts are found
    for (let i = 0; i < Math.min(amountMatches.length, transMatches.length); i++) {
        const amount = parseFloat(amountMatches[i][1].replace(/,/g, ""));
        const transactionNumber = transMatches[i][1].trim();
        
        // Push the new transaction object to the transactions array
        transactions.push({ 
            type: "cbebirr", 
            amount, 
            transactionNumber, 
            phoneNumber: undefined, 
        });
    }

    // This is the crucial part: The function must return the array
    return transactions;
}

// Ensure these parser functions are defined or imported at the top of your file
// function parseTelebirrMessage(message) { ... }
// function parseCBEMessages(message) { ... }

// Ensure these parser functions are defined or imported at the top of your file
// function parseTelebirrMessage(message) { ... }
// function parseCBEMessages(message) { ... }

exports.parseTransaction = async (req, res) => {
    try {
        console.log('Received request body:', req.body);
        const { key: message } = req.body;
        console.log('messsage is:', message);
        if (!message) return res.status(400).json({ error: "Message is required" });

        let transactions = [];
        const lowerCaseMessage = message.toLowerCase();

        const cbebirrRegex = /(?:በደረሰኝ ቁ[ጠጥ]?ር|txn id|by receipt number)\s*([a-zA-Z0-9]+)/i;
        
        if (lowerCaseMessage.match(cbebirrRegex)) {
            transactions = parseCBEMessages(message);
        }
        else if (lowerCaseMessage.includes("telebirr")) {
            // This will now use the updated parser
            transactions = parseTelebirrMessage(message);
        } else {
            return res.status(400).json({ error: "Unsupported transaction type" });
        }

        if (transactions.length === 0) {
            return res.status(400).json({ error: "No transaction found in message" });
        }
        
        // ... (The rest of your code for saving to the database is correct)
        
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
        // ✅ NEW: We now accept transactionNumber directly in the request body
        let { transactionNumber, phoneNumber, amount, type } = req.body;
        
        // Trim and parse inputs
        transactionNumber = transactionNumber ? transactionNumber.trim() : null;
        phoneNumber = phoneNumber ? phoneNumber.trim() : null;
        amount = parseFloat(amount);

        // ✅ UPDATED: Validate the new required parameter
        if (!transactionNumber || !phoneNumber || isNaN(amount) || amount <= 0 || !type || !["telebirr", "cbebirr"].includes(type.toLowerCase())) {
            return res.status(400).json({ error: "Invalid or missing parameters." });
        }
        
        const user = await BingoBord.findOne({ phoneNumber });
        
        if (!user) {
            console.error(`User not found for phone number: ${phoneNumber}`);
            return res.status(404).json({ error: "User not found. Please register or provide a valid phone number." });
        }
        
        console.log("Received transaction number directly:", transactionNumber); 

        // ✅ The core security check remains the same
        // Step 1: Find the PENDING transaction using the provided transactionNumber
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
            return res.status(400).json({ error: "Type mismatch. Please check your deposit type." });
        }

        // Step 3: If all checks pass, update the user's wallet
        user.Wallet += amount;

        // Step 4: Handle referral bonus
        if (user.referal) {
            const referer = await BingoBord.findOne({ telegramId: user.referal });
            if (referer) {
                const bonusAmount = amount * 0.05;
                referer.Wallet += bonusAmount;
                await referer.save();
                // ✅ You may want to log this referral transaction for a complete record
            }
        }

        // Step 5: Save the user's updated wallet
        await user.save();
        
        // Step 6: Delete the pending transaction.
        // This ensures it can never be used again and cleans your database.
        await Transaction.deleteOne({ transactionNumber: transactionNumber });
        
        console.log(`User wallet updated. New balance: ${user.Wallet}`);
        
        res.json({
            message: `Deposit of ${updatedTx.amount} ETB confirmed successfully! Your new wallet balance is ${user.Wallet}.`,
            wallet: user.Wallet,
        });

    } catch (err) {
        console.error("Deposit confirmation error:", err);
        res.status(500).json({ error: "An unexpected error occurred. Please check the amount you deposited and try again." });
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
