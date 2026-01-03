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
    { text: "Room 10 (Stake 10)", callback_data: "room_10" },],
   
  
 
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
    // NEW: Transfer Amount logic with 50 Birr Deposit Requirement
if (step === "waitingForTransferAmount") {
    const amount = parseFloat(text);
    const recipientId = userStates[chatId].recipientId;
    const recipientPhone = userStates[chatId].recipientPhone;

    if (isNaN(amount) || amount <= 0) {
        bot.sendMessage(chatId, "⚠️ Please enter a valid positive number.");
        return;
    }

    try {
        const sender = await BingoBord.findOne({ telegramId: chatId });
        const recipient = await BingoBord.findOne({ telegramId: recipientId });

        if (!sender || !recipient) {
            bot.sendMessage(chatId, "User not found. Please try again.");
            delete userStates[chatId];
            return;
        }

        // --- NEW DEPOSIT CHECK ---
        // Find all deposit transactions for the sender
        const depositTransactions = await Transaction.find({
            phoneNumber: sender.phoneNumber,
            method: 'deposit'
        });

        const totalDeposits = depositTransactions.reduce((sum, tx) => sum + tx.amount, 0);

        // Check if total deposits are at least 50
        if (totalDeposits < 50) {
            bot.sendMessage(chatId, `❌ Transfer Locked. You must deposit at least 50 Birr to unlock the transfer feature. Your total deposit is: ${totalDeposits} Birr.`);
            delete userStates[chatId];
            return;
        }
        // -------------------------

        if (sender.Wallet < amount) {
            bot.sendMessage(chatId, `❌ You have insufficient funds. Your current balance is ${sender.Wallet} ETB.`);
            delete userStates[chatId];
            return;
        }

        // Perform the transfer
        sender.Wallet -= amount;
        recipient.Wallet += amount;

        await Promise.all([sender.save(), recipient.save()]);

        bot.sendMessage(chatId, `✅ Successfully transferred **${amount}** Birr to **${recipient.username}**!`, { parse_mode: 'Markdown' });
        bot.sendMessage(recipientId, `🎉 You have received **${amount}** Birr from **${sender.username}**!`, { parse_mode: 'Markdown' });

    } catch (error) {
        console.error("Error performing transfer:", error);
        bot.sendMessage(chatId, "An error occurred during the transfer.");
    }

    delete userStates[chatId]; // Clear state
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
// ... inside your "withdrawAmount" check ...
if (step === "withdrawAmount") {
    // We use a self-invoking async function to handle the 'await' commands
    (async () => {
        const amount = parseFloat(text);
        
        try {
            // 1. Get real data from Database
            const user = await BingoBord.findOne({ telegramId: chatId });
            if (!user) {
                bot.sendMessage(chatId, "❌ User not found.");
                delete userStates[chatId];
                return;
            }

            // 2. Push to your Backend
            const res = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/transactions/withdraw`, {
                username: user.username,
                phoneNumber: user.phoneNumber,
                amount: amount,
                method: 'withdrawal',
                type: userStates[chatId].method
            });

            // 3. PUSH notification to your NEW ADMIN BOT
            // It will send the message directly to you (2092082952)
            const adminMessage = `
💰 **NEW WITHDRAWAL REQUEST**
━━━━━━━━━━━━━━━━━━
👤 User: ${user.username}
📞 Phone: \`${user.phoneNumber}\`
💵 Amount: ${amount} ETB
🏦 Method: ${userStates[chatId].method.toUpperCase()}
━━━━━━━━━━━━━━━━━━`;

            await adminBot.sendMessage(process.env.ADMIN_CHAT_ID, adminMessage, { parse_mode: 'Markdown' })
                .catch(e => console.log("Admin Bot alert failed, but transaction is saved."));

            // 4. Send success to user
            bot.sendMessage(chatId, res.data.message || "✅ Withdrawal request successful!");

        } catch (err) {
            console.error("WITHDRAW_ERROR:", err.response?.data || err.message);
            bot.sendMessage(chatId, "❌ Withdrawal failed. Please check your balance.");
        }

        delete userStates[chatId];
    })();
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
            user.gameHistory.slice(-10).forEach((g, i) => {
                historyText += `${i + 1}. Room: ${g.roomId}, Stake: ${g.stake}, Outcome: ${g.outcome}, gameid:${g.gameId}, Date: ${g.timestamp?.toLocaleString() || "N/A"}\n`;
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

        case "spin_game":
            bot.sendMessage(chatId, "Select your bet amount for Spin & Win:", {
                reply_markup: {
                    inline_keyboard: [[{ text: "Spin 1 ETB", callback_data: "spin_1" }]]
                }
            });
            break;

        case "deposit":
            bot.sendMessage(chatId, "💵 How much money do you want to deposit?");
            userStates[chatId] = { step: "depositAmount" };
            break;

        // FIXED: DEPOSIT CRASH PROTECTION
        case "deposit_telebirr":
        case "deposit_cbebirr":
            const depositMethod = data.split("_")[1];

            // Safety Check: If bot restarted, userStates[chatId] is gone.
            if (!userStates[chatId]) {
                bot.sendMessage(chatId, "⚠️ Session expired. Please click 'Deposit' again and enter the amount.");
                return;
            }

            const amountDep = userStates[chatId].amount || "N/A";
            let instructionsMsg = "";

            if (depositMethod === "telebirr") {
                instructionsMsg = `📲 ማኑዋል ዲፖዚት መመሪያ ቴሌብር\nAccount: \`${process.env.TELEBIRR_ACCOUNT}\`\nዲፖዚት መጠን: ${amountDep} ብር...`; // (Keep your full Amharic text here)
            } else if (depositMethod === "cbebirr") {
                instructionsMsg = `🏦 ማኑዋል ዲፖዚት መመሪያ\nAccount: \`${process.env.CBE_ACCOUNT}\`\nዲፖዚት መጠን: ${amountDep} ብር...`; // (Keep your full Amharic text here)
            }

            bot.sendMessage(chatId, instructionsMsg, { parse_mode: 'Markdown' });
            
            userStates[chatId].depositMethod = depositMethod;
            userStates[chatId].step = "depositMessage"; 
            break;

        case "withdraw":
            bot.sendMessage(chatId, "Choose your withdrawal method:", {
                reply_markup: {
                    inline_keyboard: [[
                        { text: "📲 Telebirr", callback_data: "withdraw_telebirr" },
                        { text: "🏦 CBE Birr", callback_data: "withdraw_cbebirr" }
                    ]]
                }
            });
            break;

        case "withdraw_telebirr":
        case "withdraw_cbebirr":
            const wMethod = data.split("_")[1];
            userStates[chatId] = { step: "withdrawAmount", method: wMethod };
            bot.sendMessage(chatId, `Enter the amount you want to withdraw via ${wMethod.toUpperCase()}:`);
            break;

        case "transfer_coins_to_wallet":
            const coinsToTransfer = user.coins || 0;
            const minTransfer = 0.01;

            if (coinsToTransfer < minTransfer) {
                answerQuery(`❌ You need at least ${minTransfer} coins to transfer.`, true);
                return;
            }
            
            const roundedCoins = parseFloat(coinsToTransfer.toFixed(2)); 

            try {
                const updatedUser = await BingoBord.findOneAndUpdate(
                    { telegramId: chatId, coins: { $gte: roundedCoins } },
                    { $inc: { Wallet: roundedCoins, coins: -roundedCoins } },
                    { new: true }
                );
                
                if (!updatedUser) {
                    answerQuery("❌ Transfer failed. Insufficient coins.", true);
                    return;
                }

                bot.sendMessage(chatId, `🎉 Success! **${roundedCoins} Coins** converted to Wallet.`, { parse_mode: 'Markdown' });
            } catch (error) {
                console.error("Coin Transfer Error:", error);
                answerQuery("❌ Database error.", true);
            }
            break;

        case "room_5":
        case "room_10":
            const stake = parseInt(data.split("_")[1]);
            if (user.Wallet < stake) {
                bot.sendMessage(chatId, "⚠️ Not enough birr. Earn more to play.");
                return;
            }

            const webAppUrl = `${process.env.FRONTEND_URL}/CartelaSelction?username=${encodeURIComponent(user.username)}&telegramId=${user.telegramId}&roomId=${stake}&stake=${stake}`;
            bot.sendMessage(chatId, `🎮 *play ${stake} ETB*`, {
                parse_mode: "Markdown",
                reply_markup: {
                    inline_keyboard: [[{ text: "🚀 PLAY NOW", web_app: { url: webAppUrl } }]]
                }
            });
            break;

        case "spin_1":
            const spinStake = 1; // Explicitly set based on your "spin_1" data
            if (user.Wallet < spinStake) {
                bot.sendMessage(chatId, `❌ Insufficient balance: ${user.Wallet} ETB`);
                return;
            }

            const spinnerUrl = `${process.env.FRONTEND_URL}/SpinnerSelection?username=${encodeURIComponent(user.username)}&telegramId=${user.telegramId}&stake=${spinStake}`;
            bot.sendMessage(chatId, `🎯 Ready to spin for ${spinStake} ETB!`, {
                reply_markup: {
                    inline_keyboard: [[{ text: "🎰 Launch Spinner", web_app: { url: spinnerUrl } }]]
                }
            });
            break;

        case "transactions":
            try {
                const transactions = await Transaction.find({ phoneNumber: user.phoneNumber }).sort({ createdAt: -1 }).limit(10);
                if (!transactions.length) {
                    bot.sendMessage(chatId, "No transactions found.");
                    return;
                }
                let tText = "📜 Last 10 transactions:\n";
                transactions.forEach((t, i) => {
                    // Check if properties exist before calling toUpperCase()
                    const m = t.method ? t.method.toUpperCase() : "UNKNOWN";
                    const ty = t.type ? t.type.toUpperCase() : "N/A";
                    tText += `${i + 1}. Type: ${m}, via: ${ty}, Amount: ${t.amount} ብር\n`;
                });
                bot.sendMessage(chatId, tText);
            } catch (err) {
                bot.sendMessage(chatId, "❌ History error.");
            }
            break;

        case "referral":
            const botInfo = await bot.getMe();
            const referralLink = `https://t.me/${botInfo.username}?start=${chatId}`;
            const photoId = 'AgACAgQAAxkBAAIK7mjE1Y1VX0ivUkBQGwJsXW08-92LAAKm0DEb55coUv1XJCHTpYurAQADAgADeAADNgQ'; 
            
            bot.sendPhoto(chatId, photoId, {
                caption: `*Your Referral Link:*\n🔗 [Invite Friends](${referralLink})`,
                parse_mode: 'Markdown'
            });
            break;

        case "top":
            bot.sendMessage(chatId, `🏆 *Leaderboard*`, {
                reply_markup: {
                    inline_keyboard: [[{ text: "📊 View", web_app: { url: `${process.env.FRONTEND_URL}/TopUsers` } }]]
                },
                parse_mode: "Markdown"
            });
            break;
    }
});


module.exports = bot;