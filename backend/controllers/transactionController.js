const BingoBord = require('../Models/BingoBord');
const Transaction = require("../Models/Transaction");

const Depoc=require('../Models/DepositSchema');
 
// Utility function to parse Telebirr messages
// Corrected parseTelebirrMessage function
function parseTelebirrMessage(message) {
    const transactions = [];
    
    // ✅ Removed the lowerCaseMessage line. We will work with the original message.

    // Regex to find the amount. This works.
    const amountMatches = [...message.matchAll(/ETB\s*([\d,.]+(?:\.\d{2})?)/gi)];

    // FIX: This regex is now applied to the original message.
    // It looks for "transaction number" or "transaction no"
    // and the pattern now includes both lowercase and uppercase letters ([a-zA-Z0-9]+).
    const transMatches = [...message.matchAll(/(?:transaction number is|transaction no is)\s*([a-zA-Z0-9]+)/gi)];

    for (let i = 0; i < Math.min(amountMatches.length, transMatches.length); i++) {
        const amount = parseFloat(amountMatches[i][1].replace(/,/g, ""));
        
        // This will now get the correct case from the original message.
        const transactionNumber = transMatches[i][1].trim(); 

        transactions.push({ 
            type: "telebirr", 
            amount, 
            transactionNumber, 
            phoneNumber: undefined,
        });
    }

    return transactions;
}





// Utility function to parse CBE messages (you can expand if needed)
// utils/messageParsers.js



// In your utils/messageParsers.js file
// In your utils/messageParsers.js file or where the function is located
function parseCBEMessages(message) {
    const transactions = [];
    
    // ✅ Removed the lowerCaseMessage line. We will work with the original message.

    // Regex to find the amount and currency.
    const amountMatches = [...message.matchAll(/([\d,]+\.\d+)\s*(?:br\.|ብር)/gi)];

    // ✅ FIX: This regex is now applied to the original message.
    // The pattern already correctly handles both upper and lowercase ([a-zA-Z0-9]+).
    const transMatches = [...message.matchAll(/(?:በደረሰኝ ቁ[ጠጥ]?ር|txn id|by receipt number)\s*([a-zA-Z0-9]+)/gi)];

    for (let i = 0; i < Math.min(amountMatches.length, transMatches.length); i++) {
        const amount = parseFloat(amountMatches[i][1].replace(/,/g, ""));
        
        // This will now get the correct case from the original message.
        const transactionNumber = transMatches[i][1].trim(); 
        
        transactions.push({ 
            type: "cbebirr", 
            amount, 
            transactionNumber, 
            phoneNumber: undefined, 
        });
    }

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
        
        if (!message) {
            return res.status(400).json({ error: "Message is required" });
        }

        let transactions = [];
        const telebirrRegex = /telebirr/i; // New regex for case-insensitive check

        const cbebirrRegex = /(?:በደረሰኝ ቁ[ጠጥ]?ር|txn id|by receipt number)\s*([a-zA-Z0-9]+)/i;
        
        if (message.match(cbebirrRegex)) {
            transactions = parseCBEMessages(message);
        } else if (message.match(telebirrRegex)) { // Check against the original message
            transactions = parseTelebirrMessage(message);
        } else {
            return res.status(400).json({ error: "Unsupported transaction type" });
        }

        if (transactions.length === 0) {
            return res.status(400).json({ error: "No transaction found in message" });
        }
        
        const transactionToSave = transactions[0];

        const existingTransaction = await Transaction.findOne({ transactionNumber: transactionToSave.transactionNumber });
        if (existingTransaction) {
            console.log(`Transaction ${transactionToSave.transactionNumber} already exists. Skipping.`);
            return res.status(409).json({ error: "Transaction already exists." });
        }

        const newTransaction = new Transaction({
            amount: transactionToSave.amount,
            transactionNumber: transactionToSave.transactionNumber,
            method: "depositpend",
            type: transactionToSave.type
        });
        
        await newTransaction.save();
        
        console.log("Transaction saved as pending:", newTransaction.transactionNumber);
        
        return res.status(200).json({
            message: "Transaction received and saved as pending. Please confirm your deposit.",
            transactionNumber: newTransaction.transactionNumber,
        });

    } catch (err) {
        if (err.code === 11000) {
            console.log(`Duplicate transaction encountered: ${err.message}`);
            return res.status(409).json({ error: "Transaction already exists." });
        }
        console.error("Server error:", err);
        return res.status(500).json({ error: "Server error" });
    }
};
// Add this constant at the top of your file for easy modification
 // 10% bonus
// Add this constant at the top of your file for easy modification
const extractTransactionDetails = (message) => {
    let transactionNumber, amount, type;

    // ----- telebirr Regex -----
    const telebirrRegex = /received ETB\s*([\d\.]+)\s*.*Your transaction number is\s*([A-Z0-9]+)\./i;
    const telebirrMatch = message.match(telebirrRegex);
    if (telebirrMatch) {
        amount = parseFloat(telebirrMatch[1]);
        transactionNumber = telebirrMatch[2];
        type = "telebirr";
        return { transactionNumber, amount, type };
    }

    // ----- CBE Birr Regex (English) -----
    const cbebirrEnRegex = /credited with\s*([\d\.]+)\s*Br\..*Txn ID\s*([A-Z0-9]+)\./i;
    const cbebirrEnMatch = message.match(cbebirrEnRegex);
    if (cbebirrEnMatch) {
        amount = parseFloat(cbebirrEnMatch[1]);
        transactionNumber = cbebirrEnMatch[2];
        type = "cbebirr";
        return { transactionNumber, amount, type };
    }

    // ----- CBE Birr Regex (Amharic) -----
    const cbebirrAmRegex = /([\d\.]+)\s*Br\..*በደረሰኝ ቁጥር\s*([A-Z0-9]+)\s*ተልኮሎታል።/i;
    const cbebirrAmMatch = message.match(cbebirrAmRegex);
    if (cbebirrAmMatch) {
        amount = parseFloat(cbebirrAmMatch[1]);
        transactionNumber = cbebirrAmMatch[2];
        type = "cbebirr";
        return { transactionNumber, amount, type };
    }

    return { transactionNumber: null, amount: null, type: null };
};

exports.depositAmount = async (req, res) => {
    try {
        // We now accept 'transactionNumber', 'amount', 'type', and 'phoneNumber' from the frontend
        let { transactionNumber, amount, type, phoneNumber } = req.body;
        
        // Trim and parse inputs
        let finalTxnNumber = transactionNumber ? transactionNumber.trim() : null;
        let finalAmount = parseFloat(amount);
        let finalType = type ? type.toLowerCase() : null;

        // Step 1: Validate initial inputs
        if (!finalTxnNumber || !phoneNumber || isNaN(finalAmount) || finalAmount <= 0 || !finalType || !["telebirr", "cbebirr"].includes(finalType)) {
            // This is the check for the "transaction number only" scenario
            return res.status(400).json({ error: "Invalid or missing parameters. Please provide the transaction ID, amount, and type." });
        }

        // Step 2: Check if the provided 'transactionNumber' is actually a full message.
        // If it contains a space, we assume it's a message and try to parse it.
        if (finalTxnNumber.includes(' ')) {
            const extractedDetails = extractTransactionDetails(finalTxnNumber);
            
            // If we successfully extract details, we will use those instead of the ones from the request body.
            // This adds a layer of security, as the message is the source of truth.
            if (extractedDetails.transactionNumber && !isNaN(extractedDetails.amount) && extractedDetails.type) {
                finalTxnNumber = extractedDetails.transactionNumber;
                // We'll use the extracted amount and type for validation below.
                const extractedAmount = extractedDetails.amount;
                const extractedType = extractedDetails.type;
                
                // Perform a strict check: the amount and type the user entered must match the message.
                if (finalAmount !== extractedAmount) {
                     return res.status(400).json({ error: `Amount mismatch. The message shows ETB ${extractedAmount}, but you entered ETB ${finalAmount}.` });
                }
                if (finalType !== extractedType) {
                    return res.status(400).json({ error: `Type mismatch. The message is for ${extractedType}, but you selected ${finalType}.` });
                }
            } else {
                // If parsing fails for a message with spaces, it's an invalid format.
                return res.status(400).json({ error: "Could not extract transaction details from the message. Please ensure the message is complete and in a supported format." });
            }
        }
        
        // Step 3: Find the user.
        const user = await BingoBord.findOne({ phoneNumber });
        if (!user) {
            return res.status(404).json({ error: "User not found. Please register or provide a valid phone number." });
        }
        
        // Step 4: Find the PENDING transaction using the final (parsed or provided) transactionNumber.
        const updatedTx = await Transaction.findOne({
            transactionNumber: finalTxnNumber,
            method: "depositpend"
        });
        
        if (!updatedTx) {
            return res.status(400).json({ error: "Invalid or already-claimed transaction number." });
        }

        // Step 5: Final validation against the database record.
        if (parseFloat(updatedTx.amount) !== finalAmount) {
            return res.status(400).json({ error: "Amount mismatch with the pending transaction record." });
        }
        if (updatedTx.type !== finalType) {
            return res.status(400).json({ error: "Type mismatch with the pending transaction record." });
        }

        // Step 6: Process the transaction if all checks pass.
        user.Wallet += finalAmount;
        if (user.referal) {
            const referer = await BingoBord.findOne({ telegramId: user.referal });
            if (referer) {
                const bonusAmount = finalAmount * 0.05;
                referer.Wallet += bonusAmount;
                await referer.save();
            }
        }
        await user.save();
        await Transaction.deleteOne({ transactionNumber: finalTxnNumber });
        
        console.log(`User wallet updated. New balance: ${user.Wallet}`);
        
        res.json({
            message: `Deposit of ${finalAmount} ETB confirmed successfully! Your new wallet balance is ${user.Wallet}.`,
            wallet: user.Wallet,
        });

    } catch (err) {
        console.error("Deposit confirmation error:", err);
        res.status(500).json({ error: "An unexpected error occurred. Please check your inputs and try again." });
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
