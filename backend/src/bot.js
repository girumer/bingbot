require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const BingoBord = require('../Models/BingoBord');
const Transaction = require('../Models/Transaction');
const axios = require('axios');

// ----------------------
// Connect to MongoDB
// ----------------------
const formatBalance = (amount) => {
    // Added || 0 fallback to prevent issues if 'amount' is null, undefined, or empty string
    return parseFloat(amount || 0).toFixed(2);
};
mongoose.connect(process.env.DATABASE_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("MongoDB connected"))
.catch((e) => console.log(e));

// ----------------------
// Create bot
// ----------------------
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
console.log("Telegram bot is running...");


// ----------------------
// Main Menu
// ----------------------
const mainMenu = {
  reply_markup: {
    inline_keyboard: [
      [
       { text: "🎰 Spin & Win", callback_data: "spin_game" },
        { text: "🎮 Play Bingo", callback_data: "play" },
        
      ],
      [ 
         { text: "💰 Balance", callback_data: "balance" },
      { text: "💳 Transactions", callback_data: "transactions" },
      ],
      [
        { text: "📥 Deposit", callback_data: "deposit" },
        { text: "📤 Withdraw", callback_data: "withdraw" },
       
      ],
      [
        { text: "🔗 Referral Link", callback_data: "referral" },
         { text: "🎮 Game History", callback_data: "gameHistory" },
        
      ],
[ 
   { text: "🏆 Leaders board", callback_data: "top" },
          { text: "🪙 Convert Coins", callback_data: "transfer_coins_to_wallet" }, // <-- NEW BUTTON
      ]
    ]
  }
};



const commands = [
  { command: "start", description: "🏠 start" }, // Corrected line
  { command: "balance", description: "💰 Check your balance" },
  { command: "play", description: "🎮 Play Bingo" },
  { command: "deposit", description: "📥 Deposit funds" },
  { command: "coins", description: "🪙 Check your Coin balance" },
  { command: "withdraw", description: "📤 Withdraw" },
  { command: "history", description: "📜 game  history" },
  { command: "changeusername", description: "✏️ Change your username" },
  { command: "transferwallet", description: "➡️ Transfer funds" }, 
  { command: "help", description: "ℹ️ Help info" },
   
];

bot.setMyCommands(commands)
  .then(() => console.log("Bot menu commands set successfully"))
  .catch(console.error);

// ----------------------
// User States
// ----------------------
let userStates = {}; // { chatId: { step: "askName" | "askPhone" | "depositAmount" | "depositMessage", ... } }

// ----------------------
// /start command
// ----------------------
// ----------------------
// /start command (CORRECTED)
// ----------------------
// ----------------------
// Handle Commands (like /balance, /play, etc.)
// ----------------------
bot.onText(/\/(balance|play|deposit|history|help|withdraw|coins)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const cmd = match[1]; // the command without '/'
  
    // Fetch the user
    const user = await BingoBord.findOne({ telegramId: chatId });
  
    // Call the same logic as your callback_query switch
    switch (cmd) {
      case "start":
        bot.sendMessage(chatId, "🏠 Main Menu:", mainMenu);
        break;
      case "balance":
        bot.sendMessage(chatId, `💰 Your wallet balance: ${user.Wallet} ETB`);
        break;
        case "coins": // <--- NEW CASE
       bot.sendMessage(chatId, `🪙 Your **Coin** balance: ${user.coins || 0} Coins`, { parse_mode: 'Markdown' });
        break;
      case "withdraw":
        bot.sendMessage(chatId, "Choose your withdrawal method:", {
          reply_markup: {
            inline_keyboard: [
              [
                { text: "📲 Telebirr", callback_data: "withdraw_telebirr" },
                { text: "🏦 CBE Birr", callback_data: "withdraw_cbebirr" }
              ]
            ]
          }
        });
        break;
      case "history":
        if (!user.gameHistory || user.gameHistory.length === 0) {
          bot.sendMessage(chatId, "You have no game history yet.");
          return;
        }
        
        // Get last 10 items only
        const lastGames = user.gameHistory.slice(-10);
  
        let historyText = "📜 Your last 10 game history:\n";
        lastGames.forEach((g, i) => {
          historyText += `${i + 1}. Room: ${g.roomId}, Stake: ${g.stake}, Outcome: ${g.outcome}, gameid:${g.gameId},Date: ${g.timestamp?.toLocaleString() || "N/A"}\n`;
        });
  
        bot.sendMessage(chatId, historyText);
        break;
      case "play":
        bot.sendMessage(chatId, "Select a room to play:", {
          reply_markup: {
            inline_keyboard: [
              [
                { text: "Room 5 (Stake 5)", callback_data: "room_5" },
                { text: "Room 10 (Stake 10)", callback_data: "room_10" },
              ],
              [
                { text: "Room 20 (Stake 20)", callback_data: "room_20" },
                { text: "Room 30 (Stake 30)", callback_data: "room_30" },
              ],
              [
                { text: "Room 50 (Stake 50)", callback_data: "room_50" },
                { text: "Room 100 (Stake 100)", callback_data: "room_100" },
              ]
            ]
          }
        });
        break;
        // Case for when the user selects 'Play Bingo' from the main menu
// ... existing switch cases ...

    case "spin_game": // From the main menu button
        // The Spinner game usually uses a fixed stake, but you can offer options too.
        bot.sendMessage(chatId, "Select your bet amount for Spin & Win:", {
            reply_markup: {
                inline_keyboard: [
                    [
                        // Ensure the web_app URL points to the correct component path: /SpinnerSelection
                        { text: "Spin 5 ETB", web_app: { url: `${process.env.FRONTEND_URL}/SpinnerSelection?username=${encodeURIComponent(user.username)}&telegramId=${user.telegramId}&stake=5` } },
                        { text: "Spin 10 ETB", web_app: { url: `${process.env.FRONTEND_URL}/SpinnerSelection?username=${encodeURIComponent(user.username)}&telegramId=${user.telegramId}&stake=10` } },
                    ],
                    [
                        { text: "Spin 20 ETB", web_app: { url: `${process.env.FRONTEND_URL}/SpinnerSelection?username=${encodeURIComponent(user.username)}&telegramId=${user.telegramId}&stake=30` } },
                        { text: "Spin 50 ETB", web_app: { url: `${process.env.FRONTEND_URL}/SpinnerSelection?username=${encodeURIComponent(user.username)}&telegramId=${user.telegramId}&stake=50` } },
                    ]
                ]
            }
        });
        break;

// ... rest of the switch cases ...
      case "help":
        bot.sendMessage(chatId, "Use the menu to check balance, play games, or see your history. If you need further assistance, please contact our support team.", {
          reply_markup: {
            inline_keyboard: [
              [
                { text: "🤝 Contact Support", url: `https://t.me/${process.env.SUPPORT_USERNAME}` }
              ]
            ]
          }
        });
        break;
      case "deposit":
        bot.sendMessage(chatId, "💵 How much money do you want to deposit?");
        userStates[chatId] = { step: "depositAmount" };
        break;
    }
});
bot.onText(/^\/start\s?(\d+)?$/, async (msg, match) => {
    try {
        const chatId = msg.chat.id;
        const referrerId = match[1];

        let user = await BingoBord.findOne({ telegramId: chatId });

        if (!user) {
            userStates[chatId] = { step: "waitingForContact" };

            if (referrerId && !isNaN(referrerId) && Number(referrerId) !== chatId) {
                userStates[chatId].referrerId = Number(referrerId);
            }

            bot.sendMessage(chatId, "Welcome! Please share your phone number to register:", {
                reply_markup: {
                    keyboard: [[{ text: "📱 Share Contact", request_contact: true }]],
                    resize_keyboard: true,
                    one_time_keyboard: true,
                    remove_keyboard: true
                }
            });
        } else {
            bot.sendMessage(chatId, `Welcome back, ${user.username}!`, mainMenu);
        }
    } catch (error) {
        console.error("Error in /start handler:", error);
    }
});
bot.onText(/\/changeusername/, async (msg) => {
    const chatId = msg.chat.id;

    const user = await BingoBord.findOne({ telegramId: chatId });
    if (!user) {
        bot.sendMessage(chatId, "You are not registered. Please use /start to begin.");
        return;
    }

    userStates[chatId] = { step: "waitingForNewUsername" };
    
    bot.sendMessage(chatId, "Please send your new username now. It must be a single word, without spaces.");
});
bot.onText(/\/transferwallet/, async (msg) => {
    const chatId = msg.chat.id;
    const user = await BingoBord.findOne({ telegramId: chatId });
    if (!user) {
        bot.sendMessage(chatId, "You are not registered. Please use /start to begin.");
        return;
    }
    userStates[chatId] = { step: "waitingForRecipientPhone" };
    bot.sendMessage(chatId, "Please us send the phone number of the user you want to transfer to with the following format(e.g., `251912345678`).");
});
// ----------------------
// Handle Commands (like /balance, /play, etc.)
// ----------------------
bot.onText(/\/(|balance|play|deposit|history|help|withdraw)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const cmd = match[1]; // the command without '/'

  // Fetch the user
  const user = await BingoBord.findOne({ telegramId: chatId });
  // ----------------------
// /start command
// ----------------------


  // Call the same logic as your callback_query switch
  switch (cmd) {
  
    case "balance":
      bot.sendMessage(chatId, `💰 Your wallet balance: ${user.Wallet} ETB`);
      break;
       case "withdraw":
      bot.sendMessage(chatId, "Choose your withdrawal method:", {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "📲 Telebirr", callback_data: "withdraw_telebirr" },
              { text: "🏦 CBE Birr", callback_data: "withdraw_cbebirr" }
            ]
          ]
        }
      });
      break;
      
  case "history":
  if (!user.gameHistory || user.gameHistory.length === 0) {
    bot.sendMessage(chatId, "You have no game history yet.");
    return;
  }
   
  // Get last 10 items only
  const lastGames = user.gameHistory.slice(-10);

  let historyText = "📜 Your last 10 game history:\n";
  lastGames.forEach((g, i) => {
    historyText += `${i + 1}. Room: ${g.roomId}, Stake: ${g.stake}, Outcome: ${g.outcome}, gameid:${g.gameId},Date: ${g.timestamp?.toLocaleString() || "N/A"}\n`;
  });

  bot.sendMessage(chatId, historyText);
  break;
    
    case "play":
      bot.sendMessage(chatId, "Select a room to play:", {
        reply_markup: {
        inline_keyboard: [
  [
    { text: "Room 5 (Stake 5)", callback_data: "room_5" },
    { text: "Room 10 (Stake 10)", callback_data: "room_10" },],
    [
    { text: "Room 20 (Stake 20)", callback_data: "room_20" },
    { text: "Room 30 (Stake 30)", callback_data: "room_30" },
    ],
  
  [
    
    { text: "Room 50 (Stake 50)", callback_data: "room_50" },
    { text: "Room 100 (Stake 100)", callback_data: "room_100" },
  ]
]

        }
      });
  break;
  
      
    
    case "help":
     bot.sendMessage(chatId, "Use the menu to check balance, play games, or see your history. If you need further assistance, please contact our support team.", {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "🤝 Contact Support", url: `https://t.me/${process.env.SUPPORT_USERNAME}` }
                ]
            ]
        }
    });
      break;
      
    case "deposit":
      bot.sendMessage(chatId, "💵 How much money do you want to deposit?");
      userStates[chatId] = { step: "depositAmount" };
      break;
  }
});

// ----------------------
// Handle Text Messages
// ----------------------
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!userStates[chatId]) return;

  const step = userStates[chatId].step;

  // Ask Name
 

  // Deposit Amount
 // ...
// Deposit Amount
  if (step === "waitingForNewUsername") {
        const newUsername = text.trim();
        delete userStates[chatId]; // Clear state immediately

        if (newUsername.includes(' ') || newUsername.length < 3) {
            bot.sendMessage(chatId, "Invalid username. Usernames must be a single word and at least 3 characters long. Please try again with /changeusername.");
            return;
        }

        try {
            const user = await BingoBord.findOne({ telegramId: chatId });
            if (!user) {
                bot.sendMessage(chatId, "User not found. Please start with /start.");
                return;
            }

            const existingUser = await BingoBord.findOne({ username: newUsername });
            if (existingUser) {
                bot.sendMessage(chatId, `The username "${newUsername}" is already taken. Please choose another one.`);
                return;
            }

            user.username = newUsername;
            await user.save();

            bot.sendMessage(chatId, `✅ Your username has been successfully changed to **${newUsername}**!`, { parse_mode: 'Markdown' });

        } catch (error) {
            console.error("Error changing username:", error);
            bot.sendMessage(chatId, "An error occurred while changing your username. Please try again later.");
        }
        return;
    }
    // NEW: Transfer Phone Number logic
    if (step === "waitingForRecipientPhone") {
        const recipientPhone = text.trim();
        try {
            const recipient = await BingoBord.findOne({ phoneNumber: recipientPhone });
            if (!recipient) {
                bot.sendMessage(chatId, "❌ No user found with that phone number. Please try again or use /transfer to start over.");
                delete userStates[chatId];
                return;
            }
            // Save recipient details to state and move to the next step
            userStates[chatId] = { step: "waitingForTransferAmount", recipientId: recipient.telegramId, recipientPhone: recipient.phoneNumber };
            bot.sendMessage(chatId, `Found user: **${recipient.username}**. How much do you want to transfer?`, { parse_mode: 'Markdown' });
        } catch (error) {
            console.error("Error finding recipient:", error);
            bot.sendMessage(chatId, "An error occurred. Please try again later.");
            delete userStates[chatId];
        }
        return;
    }

    // NEW: Transfer Amount logic
    if (step === "waitingForTransferAmount") {
        const amount = parseFloat(text);
        const recipientId = userStates[chatId].recipientId;
        const recipientPhone = userStates[chatId].recipientPhone;

        delete userStates[chatId]; // Clear state immediately

        if (isNaN(amount) || amount <= 0) {
            bot.sendMessage(chatId, "⚠️ Please enter a valid positive number.");
            return;
        }

        try {
            const sender = await BingoBord.findOne({ telegramId: chatId });
            const recipient = await BingoBord.findOne({ telegramId: recipientId });

            if (!sender || !recipient) {
                bot.sendMessage(chatId, "User not found. Please try again.");
                return;
            }
            
            if (sender.Wallet < amount) {
                bot.sendMessage(chatId, `❌ You have insufficient funds. Your current balance is ${sender.Wallet} ETB.`);
                return;
            }
            
            // Perform the transfer
            sender.Wallet -= amount;
            recipient.Wallet += amount;
            
            await Promise.all([sender.save(), recipient.save()]);

            bot.sendMessage(chatId, `✅ Successfully transferred **${amount}** birr to **${recipient.username}**! Your new balance is ${sender.Wallet} Birr.`, { parse_mode: 'Markdown' });
            bot.sendMessage(recipientId, `🎉 You have received **${amount}** birr from **${sender.username}**! Your new balance is ${recipient.Wallet} Birr.`, { parse_mode: 'Markdown' });
        } catch (error) {
            console.error("Error performing transfer:", error);
            bot.sendMessage(chatId, "An error occurred during the transfer. Please try again later.");
        }
        return;
    }
    
if (step === "depositAmount") {
    const amount = parseFloat(text);
    if (isNaN(amount) || amount <= 0) {
        bot.sendMessage(chatId, "⚠️ Please enter a valid amount.");
        return;
    }
    userStates[chatId].amount = amount;

    // ✅ New Logic: Directly present the deposit method options
    bot.sendMessage(chatId, "Choose your deposit method:", {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "📲 Telebirr", callback_data: "deposit_telebirr" },
                    { text: "🏦 CBE Birr", callback_data: "deposit_cbebirr" }
                ]
            ]
        }
    });
    // Update the state to wait for the method selection
    userStates[chatId].step = "selectDepositMethod"; 
    return;
}
// ...
if (step === "withdrawAmount") {
    const amount = parseFloat(text);
     const MIN_REMAINING_BALANCE = 50; 
    if (isNaN(amount) || amount <= 0) {
      bot.sendMessage(chatId, "⚠️ Please enter a valid withdrawal amount.");
      return;
    }
if (amount < 50) {
        bot.sendMessage(chatId, "❌ The minimum withdrawal amount is 50 Birr.");
        return; // Stop the function here
    }
    const type = userStates[chatId].method;

    try {
      const user = await BingoBord.findOne({ telegramId: chatId });
      if (!user) {
        bot.sendMessage(chatId, "User not found. Please /start first.");
        delete userStates[chatId];
        return;
      }
      const depositTransactions = await Transaction.find({
            phoneNumber: user.phoneNumber,
            method: 'deposit' // Make sure this matches your model field
        });
          const totalDeposits = depositTransactions.reduce((sum, tx) => sum + tx.amount, 0);
 if (totalDeposits < 50) {
            bot.sendMessage(chatId, `❌ Withdrawal requires a total deposit of at least 50 Birr. Your total deposit is only ${totalDeposits} Birr.`);
            delete userStates[chatId]; // Clear state
            return;
        }
          if (user.Wallet < amount) {
            bot.sendMessage(chatId, `❌ You have insufficient funds. Your current balance is ${user.Wallet} ETB.`);
            delete userStates[chatId];
            return;
        }
         const maxWithdrawalAmount = user.Wallet - MIN_REMAINING_BALANCE;
         if (maxWithdrawalAmount < 0) {
            // User's balance is already below 50 (e.g., balance is 40).
            bot.sendMessage(chatId, `❌ Your current balance (${user.Wallet} Birr) is less than the required minimum play balance of ${MIN_REMAINING_BALANCE} Birr. You cannot withdraw.`);
            delete userStates[chatId];
            return;
        }
        
        if (amount > maxWithdrawalAmount) {
            // User is requesting too much (e.g., balance 230, requesting 181).
            bot.sendMessage(chatId, `❌ You must leave at least ${MIN_REMAINING_BALANCE} Birr in your wallet. The maximum amount you can withdraw is **${maxWithdrawalAmount} Birr**.`);
            delete userStates[chatId];
            return;
        }
const txType = userStates[chatId].method; 
      const res = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/transactions/withdraw`, {
        username: user.username,
        phoneNumber: user.phoneNumber,
        amount,
        method: 'withdrawal', // <-- This is the transaction type
        type: userStates[chatId].method
     
      });

      bot.sendMessage(chatId, res.data.message || "✅ Withdrawal successful!");
    } catch (err) {
      bot.sendMessage(chatId, err.response?.data?.message || "❌ Withdrawal failed.");
    }

    delete userStates[chatId]; // clear state
    return;
  }
  // Deposit Message
  if (step === "depositMessage") {
    try {
      const user = await BingoBord.findOne({ telegramId: chatId });
      if (!user) {
        bot.sendMessage(chatId, "User not found. Please /start first.");
        return;
      }
     const depositAmount = userStates[chatId].amount;
      const res = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/deposit`, {
        transactionNumber: text,
        phoneNumber: user.phoneNumber,
         amount: depositAmount,
         method: 'deposit', // <-- This should be the transaction type
         type: userStates[chatId].depositMethod

      });

      bot.sendMessage(chatId, res.data.message || "Deposit claimed successfully! 🎉");
    } catch (err) {
      bot.sendMessage(chatId, err.response?.data?.error || "Failed to claim deposit.");
    }
    delete userStates[chatId];
    return;
  }
});

// ----------------------
// Handle Contact
// ----------------------
// ----------------------
// Handle Contact
// ----------------------
// ----------------------
// Handle Contact
// ----------------------
bot.on("contact", async (msg) => {
  const chatId = msg.chat.id;
  const contact = msg.contact;
  const state = userStates[chatId];

  if (state && state.step === "waitingForContact") {
    let existingUser = await BingoBord.findOne({ telegramId: chatId });
    if (existingUser) {
      bot.sendMessage(chatId, "⚠️ This phone number is already registered.");
      delete userStates[chatId];
      return;
    }

    const username = contact.first_name + (contact.last_name ? " " + contact.last_name : "");
    const newUser = new BingoBord({
      telegramId: chatId,
      username: username,
      phoneNumber: contact.phone_number,
      Wallet: 5,
      gameHistory: [],
      // NEW: Add the referrer's ID to the new user's document
      referredBy: state.referrerId || null,
      referralBonusPaid: false, // Explicitly set, though it's the default
    });

    await newUser.save();

    delete userStates[chatId];
    bot.sendMessage(chatId, "✅ Registration complete! 🎉", mainMenu);
  }
});
// ----------------------
// Handle Menu Buttons
// ----------------------
bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  const answerQuery = (text, showAlert) => bot.answerCallbackQuery(callbackQuery.id, { text: text, show_alert: showAlert });
  const user = await BingoBord.findOne({ telegramId: chatId });
  if (!user) {
    bot.sendMessage(chatId, "You are not registered. Use /start to register.");
    return;
  }

  switch (data) {
    case "balance":
      bot.sendMessage(chatId, `💰 Your wallet balance: ${user.Wallet} Birr`);
      break;

    case "history":
      if (!user.gameHistory || user.gameHistory.length === 0) {
        bot.sendMessage(chatId, "You have no game history yet.");
        return;
      }
      let historyText = "📜 Your game history:\n";
      user.gameHistory.forEach((g, i) => {
        historyText += `${i + 1}. Room: ${g.roomId}, Stake: ${g.stake}, Outcome: ${g.outcome}, gameid:${g.gameId},Date: ${g.timestamp?.toLocaleString() || "N/A"}\n`;
      });
      bot.sendMessage(chatId, historyText);
      break;

    case "play":
      bot.sendMessage(chatId, "Select a room to play:", {
        reply_markup: {
        
        inline_keyboard: [
  [
    { text: "Room 5 (Stake 5)", callback_data: "room_5" },
    { text: "Room 10 (Stake 10)", callback_data: "room_10" },],
    [
    { text: "Room 20 (Stake 20)", callback_data: "room_20" },
    { text: "Room 30 (Stake 30)", callback_data: "room_30" },
    ],
  
  [
    
    { text: "Room 50 (Stake 50)", callback_data: "room_50" },
    { text: "Room 100 (Stake 100)", callback_data: "room_100" },
  ]
]

        }
      });
      break;

    case "gameHistory":
      if (!user.gameHistory || user.gameHistory.length === 0) {
        bot.sendMessage(chatId, "🎮 You have no game history yet.");
        return;
      }

      let gameText = "🎮 Last 10 Games:\n";
      user.gameHistory
        .slice(-10) // last 10 only
        .reverse() // newest first
        .forEach((g, i) => {
          gameText += `${i + 1}. Room: ${g.roomId}, Stake: ${g.stake}, Outcome: ${g.outcome}, gameid:${g.gameId},Date: ${g.timestamp?.toLocaleString() || "N/A"}\n`;
        });

      bot.sendMessage(chatId, gameText);
      break;
      

    case "deposit":
      bot.sendMessage(chatId, "💵 How much money do you want to deposit?");
      userStates[chatId] = { step: "depositAmount" };
      break;

   case "deposit_telebirr":
case "deposit_cbebirr":
    const depositMethod = data.split("_")[1];
    const amountDep = userStates[chatId]?.amount || "N/A";

    let instructionsMsg = "";
if (depositMethod === "telebirr") {
  instructionsMsg = `
📲 ማኑዋል ዲፖዚት መመሪያ ቴሌብር
Account: \`${process.env.TELEBIRR_ACCOUNT}\`
ዲፖዚት መጠን: ${amountDep} ብር

1\\. ከላይ ባለው ቁጥር TeleBirr በመጠቀም  ${amountDep} ብር ያስገቡ
2\\. ብሩን ስትልኩ የከፈላችሁበትን መረጃ የያዘ አጭር የጹሁፍ መልክት\\(sms\\) ከ TeleBirr ይደርሳችኋል
3\\. የደረሳችሁን አጭር የጹሁፍ መለክት\\(sms\\) የደረሳችሁን ትራንዛክሸን ቁጥር  ብቻ ኮፒ አርጋችሁ ወደዚህ ቦት ላኩ\\(copy\\) በማረግ ወደዚህ ቦት ይላኩ
⚠️ አስፈላጊ ማሳሰቢያ:
•1\\. ከTeleBirr የደረሳችሁን አጭር የጹሁፍ መለክት\\(sms\\) ሙሉዉን መላክ ያረጋግጡ
•2\\. ብር ማስገባት የምችሉት ከታች ባሉት አማራጮች ብቻ ነው
•     ከቴሌብር ወደ ኤጀንት ቴሌብር ብቻ
•     ከሲቢኢ ብር ወደ ኤጀንት ሲቢኢ ብር ብቻ
ከሲቢኢ ብር ወደ ኤጀንት ሲቢኢ ብር ብቻ ለእገዛ በሚከተለው ቴሌግራም ግሩፓቸን ቪደዮ [እዚህ ይጫኑ](${process.env.SUPPORT_GROUP})ይመለከቱ`;
} else if (depositMethod === "cbebirr") {
  instructionsMsg = `
🏦 ማኑዋል ዲፖዚት መመሪያ
Account: \`${process.env.CBE_ACCOUNT}\`
ዲፖዚት መጠን: ${amountDep} ብር

1\\. ከላይ ባለው ቁጥር ሲቢኢ  በመጠቀም  ${amountDep}ብር ያስገቡ
2\\. ብሩን ስትልኩ የከፈላችሁበትን መረጃ የያዘ አጭር የጹሁፍ መልክት\\(sms\\) ከ TeleBirr ይደርሳችኋል
3\\. የደረሳችሁን አጭር የጹሁፍ መለክት\\(sms\\) የደረሳችሁን ትራንዛክሸን ቁጥር  ብቻ ኮፒ አርጋችሁ ወደዚህ ቦት ላኩ\\(copy\\) በማረግ ወደዚህ ቦት ይላኩ
⚠️ አስፈላጊ ማሳሰቢያ:
•1\\. ከcbebirr የደረሳችሁን አጭር የጹሁፍ መለክት\\(sms\\) ሙሉዉን መላክ ያረጋግጡ
•2\\. ብር ማስገባት የምችሉት ከታች ባሉት አማራጮች ብቻ ነው
•     ከቴሌብር ወደ ኤጀንት ቴሌብር ብቻ
•     ከሲቢኢ ብር ወደ ኤጀንት ሲቢኢ ብር ብቻ ለእገዛ በሚከተለው ቴሌግራም ግሩፓቸን ቪደዮ[እዚህ ይጫኑ](${process.env.SUPPORT_GROUP}) ይመለከቱ`;
}
// ...
    
    // ✅ Keep only this single bot.sendMessage call.
    bot.sendMessage(chatId, instructionsMsg, {
        parse_mode: 'MarkdownV2'
    });
    
    userStates[chatId].depositMethod = depositMethod;
    userStates[chatId].step = "depositMessage"; 
    break;
  
  case "withdraw":
    bot.sendMessage(chatId, "Choose your withdrawal method:", {
      reply_markup: {
       inline_keyboard: [
  [
    { text: "📲 Telebirr", callback_data: "withdraw_telebirr" },
    { text: "🏦 CBE Birr", callback_data: "withdraw_cbebirr" }
  ]
]

      }
    });
    break;
     case "withdraw_telebirr":
  case "withdraw_cbebirr":
    const method = data.split("_")[1]; // telebirr / cbebirr
    userStates[chatId] = { step: "withdrawAmount", method };
    bot.sendMessage(chatId, `Enter the amount you want to withdraw via ${method.toUpperCase()}:`);
    break;
      case "transfer_coins_to_wallet":
      // 'user' is the pre-fetched BingoBord document for the user
      const coinsToTransfer = user.coins || 0;
      const minTransfer = 0.01; // Minimum coin amount to initiate transfer

      if (coinsToTransfer < minTransfer) {
        // answerQuery is a helper to respond to the Telegram callback
        answerQuery(`❌ You need at least ${minTransfer} coins to transfer.`, true);
        return;
      }
      
      // Use the actual coins to transfer (rounded to 2 decimal places)
      const roundedCoins = parseFloat(formatBalance(coinsToTransfer)); 

      try {
        answerQuery("Processing coin transfer...", false);

        // ATOMIC OPERATION: Check the coin balance is sufficient AND execute the update
        const updatedUser = await BingoBord.findOneAndUpdate(
          { telegramId: chatId, coins: { $gte: roundedCoins } }, // Atomic check and target
          {
            $inc: { Wallet: roundedCoins, coins: -roundedCoins } // Add to Wallet, Subtract from coins
          },
          { new: true } // Return the updated document
        );
        
        if (!updatedUser) {
          // Failed because the coin balance check in the query failed (race condition or insufficient funds)
          answerQuery("❌ Transfer failed. Your coin balance might have changed or you have insufficient coins.", true);
          return;
        }

        // Get fresh balances from the updated document
        const newWalletBalance = updatedUser.Wallet;
        const newCoinBalance = updatedUser.coins; 
        
        // Send success message
        bot.sendMessage(chatId, 
          `🎉 Success! **${formatBalance(roundedCoins)} Coins** converted to Wallet.
          
New balances:
💰 Wallet: **${formatBalance(newWalletBalance)} Birr**
🪙 Coins: **${formatBalance(newCoinBalance)} Coins**`, 
          { parse_mode: 'Markdown' }
        );

      } catch (error) {
        console.error("Coin Transfer Error:", error);
        answerQuery("❌ Transfer failed due to a database error.", true);
      }
      break;
case "room_5":
case "room_50":
case "room_100":
case "room_10":
case "room_20":
case "room_30":
  const stake = parseInt(data.split("_")[1]);
  if (user.Wallet < stake) {
    bot.sendMessage(chatId, "⚠️ Not enough birr. Earn more to play.");
    return;
  }

  
  await user.save();

  const webAppUrl = `${process.env.FRONTEND_URL}/CartelaSelction?username=${encodeURIComponent(user.username)}&telegramId=${user.telegramId}&roomId=${stake}&stake=${stake}`;
  
  // ✅ Corrected Markdown: Added a closing *
  bot.sendMessage(chatId, `🎮 *play ${stake} ETB*`, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{
          text: "🚀 PLAY NOW", 
          web_app: { url: webAppUrl }
        }]
      ]
    }
  });
  break;
    // Alternative: If you want to automatically open the web app without a button
  // Note: This requires the user to have interacted with the bot first
  // bot.sendMessage(chatId, `✅ You joined Room ${stake}! ${stake} coins deducted.`, {
  //   reply_markup: {
  //     inline_keyboard: [
  //       [{ text: "Continue", web_app: { url: webAppUrl } }]
  //     ]
  //   }
  // });
  
case "transactions":
  try {
    // Fetch last 10 transactions for the user's phone number
    const transactions = await Transaction.find({ phoneNumber: user.phoneNumber })
      .sort({ createdAt: -1 }) // newest first
      .limit(10);

    if (!transactions || transactions.length === 0) {
      bot.sendMessage(chatId, "You have no transaction history yet.");
      return;
    }

    let historyText = "📜 Your last 10 transactions:\n";
    transactions.forEach((t, i) => {
      // Corrected line below: t.method and t.type are the correct keys
        historyText += `${i + 1}. Type: ${t.method.toUpperCase()}, via: ${t.type.toUpperCase()}, Amount: ${t.amount} ብር, Date: ${t.createdAt.toLocaleString()}\n`;
    });

    bot.sendMessage(chatId, historyText);
  } catch (err) {
    console.error(err);
    bot.sendMessage(chatId, "❌ Failed to fetch transaction history.");
  }
  break;
case "referral":
    // Get the bot's username dynamically from the API.
    const botInfo = await bot.getMe();
    const botUsername = botInfo.username;
    
    // Use the bot's username and the correct user ID from the callbackQuery.
    const referralLink = `https://t.me/${botUsername}?start=${callbackQuery.from.id}`;
    
    // This is the file_id you found.
    const botProfilePictureId = 'AgACAgQAAxkBAAIK7mjE1Y1VX0ivUkBQGwJsXW08-92LAAKm0DEb55coUv1XJCHTpYurAQADAgADeAADNgQ'; 
    
    // Use the [Text](URL) format to create a clickable link
    const captionText = `
*Here is your personal referral link!*
    
ከታች ያለውን ሊንክ ለወዳጆቾ በመጋበዝ የጋበዟቸው ደንበኞች ከሚያስቀምጡት ዲፖዛት የማያቋርጥ የ10% ባለድርሻ ይሁኑ.
    
🔗 [Click Here to Invite](${referralLink})
    
እየተዝናን አብረን  እንስራ
`;
    
    bot.sendPhoto(
        chatId,
        botProfilePictureId, 
        {
            caption: captionText,
            parse_mode: 'Markdown'
        }
    );
    break;
 case "top":
        const topUsersUrl = `${process.env.FRONTEND_URL}/TopUsers`;
        
        bot.sendMessage(chatId, `🏆 *View the Leaders Board!*`, {
            parse_mode: "Markdown",
            reply_markup: {
                inline_keyboard: [
                    [{
                        text: "📊 View Leaderboard",
                        web_app: { url: topUsersUrl }
                    }]
                ]
            }
        });
        break;
    
    default:
      bot.sendMessage(chatId, "Unknown action occured.");
  }

// TEMPORARY CODE TO GET PHOTO FILE_ID

});
module.exports = bot;