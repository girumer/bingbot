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
// ----------------------
// Create bot (CLEAN VERSION)
// ----------------------
let bot;

// ONLY the first core (0) handles the polling connection
if (!process.env.NODE_APP_INSTANCE || process.env.NODE_APP_INSTANCE === '0') {
    bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
    console.log("MASTER CORE (0): Telegram bot is running with polling...");
} 
else {
    // Other cores create the bot WITHOUT polling
    bot = new TelegramBot(process.env.BOT_TOKEN, { polling: false });
    console.log(`WORKER CORE (${process.env.NODE_APP_INSTANCE}): Logic worker active (no polling).`);
}

// Admin bot and IDs (these don't use polling, so they are fine on all cores)

const adminBot = new TelegramBot(process.env.ADMIN_BOT_TOKEN); 
const ADMIN_ID = process.env.ADMIN_CHAT_ID;



// ----------------------
// Main Menu
// ----------------------
const mainMenu = {
  reply_markup: {
    inline_keyboard: [
      [
       
        { text: "🎮 Play Bingo", callback_data: "play" },
        { text: "🎰 Spin & Win", callback_data: "spin_game" },
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
              ]
            ]
          }
        });
        break;
        // Case for when the user selects 'Play Bingo' from the main menu
// ... existing switch cases ...

       

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
    { text: "Room 10 (Stake 10)", callback_data: "room_10" },]
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
      const adminAlert = ` 🏦 **WITHDRAWAL ALERT** 🏦 ━━━━━━━━━━━━━━━━━━ 
      👤 **User:** ${user.username} 
      📱 **Phone:** \`${user.phoneNumber}\`
      💵 **Amount:** \`${amount}\` Birr 🏛️ **Bank:** ${(userStates[chatId].method || 'N/A').toUpperCase()} 🕒 **Time:** ${new Date().toLocaleString()} ━━━━━━━━━━━━━━━━━━`;
       await adminBot.sendMessage(ADMIN_ID, adminAlert, { parse_mode: 'Markdown' });
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

    // FIX 1: Add .catch() to answerQuery to prevent "query ID not found" crashes
    const answerQuery = (text, showAlert) => 
        bot.answerCallbackQuery(callbackQuery.id, { text: text, show_alert: showAlert })
           .catch(err => console.error("Callback Answer Error:", err.message));

    // FIX 2: Wrap everything in a try/catch
    try {
        const user = await BingoBord.findOne({ telegramId: chatId });
        
        if (!user) {
            return bot.sendMessage(chatId, "You are not registered. Use /start to register.");
        }

        switch (data) {
            case "balance":
                // FIX 3: Use || 0 to prevent "undefined" display
                bot.sendMessage(chatId, `💰 Your wallet balance: ${user.Wallet || 0} Birr`);
                break;

            case "history":
            case "gameHistory":
                if (!user.gameHistory || user.gameHistory.length === 0) {
                    return bot.sendMessage(chatId, "You have no game history yet.");
                }
                let gameText = data === "gameHistory" ? "🎮 Last 10 Games:\n" : "📜 Your game history:\n";
                user.gameHistory
                    .slice(-10)
                    .reverse()
                    .forEach((g, i) => {
                        gameText += `${i + 1}. Room: ${g.roomId}, Stake: ${g.stake}, Outcome: ${g.outcome}, gameid:${g.gameId || 'N/A'}\n`;
                    });
                bot.sendMessage(chatId, gameText);
                break;

            case "transfer_coins_to_wallet":
                const coinsToTransfer = user.coins || 0;
                const minTransfer = 0.01;

                if (coinsToTransfer < minTransfer) {
                    return answerQuery(`❌ You need at least ${minTransfer} coins to transfer.`, true);
                }

                const roundedCoins = parseFloat(formatBalance(coinsToTransfer)); 

                // This try/catch inside the case is good for specific database errors
                try {
                    await answerQuery("Processing coin transfer...", false);

                    const updatedUser = await BingoBord.findOneAndUpdate(
                        { telegramId: chatId, coins: { $gte: roundedCoins } },
                        { $inc: { Wallet: roundedCoins, coins: -roundedCoins } },
                        { new: true }
                    );
                    
                    if (!updatedUser) {
                        return bot.sendMessage(chatId, "❌ Transfer failed. Insufficient coins.");
                    }

                    bot.sendMessage(chatId, 
                        `🎉 Success! **${formatBalance(roundedCoins)} Coins** converted.\n\n💰 Wallet: **${formatBalance(updatedUser.Wallet)} Birr**\n🪙 Coins: **${formatBalance(updatedUser.coins)} Coins**`, 
                        { parse_mode: 'Markdown' }
                    );
                } catch (innerError) {
                    console.error("Coin Transfer Error:", innerError);
                    bot.sendMessage(chatId, "❌ Database error during transfer.");
                }
                break;

            case "room_5":
            case "room_10":
                const stake = parseInt(data.split("_")[1]);
                if ((user.Wallet || 0) < stake) {
                    return bot.sendMessage(chatId, "⚠️ Not enough birr. Earn more to play.");
                }
                const webAppUrl = `${process.env.FRONTEND_URL}/CartelaSelction?username=${encodeURIComponent(user.username)}&telegramId=${user.telegramId}&roomId=${stake}&stake=${stake}`;
                bot.sendMessage(chatId, `🎮 *play ${stake} ETB*`, {
                    parse_mode: "Markdown",
                    reply_markup: {
                        inline_keyboard: [[{ text: "🚀 PLAY NOW", web_app: { url: webAppUrl } }]]
                    }
                });
                break;

            case "referral":
                const botInfo = await bot.getMe();
                const referralLink = `https://t.me/${botInfo.username}?start=${chatId}`;
                const botProfilePictureId = 'AgACAgQAAxkBAAIK7mjE1Y1VX0ivUkBQGwJsXW08-92LAAKm0DEb55coUv1XJCHTpYurAQADAgADeAADNgQ'; 
                
                bot.sendPhoto(chatId, botProfilePictureId, {
                    caption: `*Invite Link:*\n${referralLink}`,
                    parse_mode: 'Markdown'
                }).catch(err => bot.sendMessage(chatId, `🔗 Invite Link: ${referralLink}`));
                break;

            // ... include other cases here (top, transactions, etc.)
            
            default:
                bot.sendMessage(chatId, "Unknown action occurred.");
        }
    } catch (globalError) {
        console.error("CRITICAL ERROR IN CALLBACK:", globalError);
        // This ensures the bot stays alive even if something totally unexpected happens
    }
});
module.exports = bot;