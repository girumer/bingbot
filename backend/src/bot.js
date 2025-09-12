require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const BingoBord = require('../Models/BingoBord');
const Transaction = require('../Models/Transaction');
const axios = require('axios');

// ----------------------
// Connect to MongoDB
// ----------------------
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
        { text: "💰 Balance", callback_data: "balance" },
        { text: "🎮 Play Bingo", callback_data: "play" },
       
      ],
      [ { text: "📥 Deposit", callback_data: "deposit" },
      { text: "💳 Transactions", callback_data: "transactions" },
      ],
      [
        { text: "📤 Withdraw", callback_data: "withdraw" },
        { text: "🎮 Game History", callback_data: "gameHistory" },
        
      ]
    ]
  }
};



const commands = [
  { command: "start", description: "🏠 start" }, // Corrected line
  { command: "balance", description: "💰 Check your balance" },
  { command: "play", description: "🎮 Play Bingo" },
  { command: "deposit", description: "📥 Deposit funds" },
  { command: "withdraw", description: "📤 Withdraw" },
  { command: "history", description: "📜 game  history" },
  { command: "help", description: "ℹ️ Help info" }
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
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  let user = await BingoBord.findOne({ telegramId: chatId });

  if (!user) {
    userStates[chatId] = { step: "askName" };
    bot.sendMessage(chatId, "Welcome! Please enter your name:");
  } else {
    bot.sendMessage(chatId, `Welcome back, ${user.username}!`, mainMenu);
  }
});
// ----------------------
// Handle Commands (like /balance, /play, etc.)
// ----------------------
bot.onText(/\/(start|balance|play|deposit|history|help|withdraw)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const cmd = match[1]; // the command without '/'

  // Fetch the user
  const user = await BingoBord.findOne({ telegramId: chatId });
  if (!user) {
    bot.sendMessage(chatId, "You are not registered. Use /start to register.");
    return;
  }

  // Call the same logic as your callback_query switch
  switch (cmd) {
    case "start":
      bot.sendMessage(chatId, "🏠 Main Menu:", mainMenu);
      break;
    case "balance":
      bot.sendMessage(chatId, `💰 Your wallet balance: ${user.Wallet} coins`);
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
  if (step === "askName") {
    userStates[chatId].name = text;
    userStates[chatId].step = "askPhone";
    bot.sendMessage(chatId, "Please share your phone number:", {
      reply_markup: {
        keyboard: [[{ text: "📱 Share Contact", request_contact: true }]],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    });
    return;
  }

  // Deposit Amount
 // ...
// Deposit Amount
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
    if (isNaN(amount) || amount <= 0) {
      bot.sendMessage(chatId, "⚠️ Please enter a valid withdrawal amount.");
      return;
    }

    const type = userStates[chatId].method;

    try {
      const user = await BingoBord.findOne({ telegramId: chatId });
      if (!user) {
        bot.sendMessage(chatId, "User not found. Please /start first.");
        delete userStates[chatId];
        return;
      }
const txType = userStates[chatId].method; 
      const res = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/transactions/withdraw`, {
        username: user.username,
        phoneNumber: user.phoneNumber,
        amount,
        type:txType
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
        message: text,
        phoneNumber: user.phoneNumber,
         amount: depositAmount,
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
bot.on("contact", async (msg) => {
  const chatId = msg.chat.id;
  const contact = msg.contact;

  if (userStates[chatId] && userStates[chatId].step === "askPhone") {
    let existingUser = await BingoBord.findOne({ telegramId: chatId });
    if (existingUser) {
      bot.sendMessage(chatId, "⚠️ This phone number is already registered.");
      delete userStates[chatId];
      return;
    }

    const newUser = new BingoBord({
      telegramId: chatId,
      username: userStates[chatId].name,
      phoneNumber: contact.phone_number,
      Wallet: 100,
      gameHistory: []
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

  const user = await BingoBord.findOne({ telegramId: chatId });
  if (!user) {
    bot.sendMessage(chatId, "You are not registered. Use /start to register.");
    return;
  }

  switch (data) {
    case "balance":
      bot.sendMessage(chatId, `💰 Your wallet balance: ${user.Wallet} coins`);
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
3\\. የደረሳችሁን አጭር የጹሁፍ መለክት\\(sms\\) ሙሉዉን ኮፒ\\(copy\\) በማረግ ወደዚህ ቦት ይላኩ
⚠️ አስፈላጊ ማሳሰቢያ:
•1\\. ከTeleBirr የደረሳችሁን አጭር የጹሁፍ መለክት\\(sms\\) ሙሉዉን መላክ ያረጋግጡ
•2\\. ብር ማስገባት የምችሉት ከታች ባሉት አማራጮች ብቻ ነው
•     ከቴሌብር ወደ ኤጀንት ቴሌብር ብቻ
•     ከሲቢኢ ብር ወደ ኤጀንት ሲቢኢ ብር ብቻ
እገዛ ይፈልጋሉ?`;
} else if (depositMethod === "cbebirr") {
  instructionsMsg = `
🏦 ማኑዋል ዲፖዚት መመሪያ
Account: \`${process.env.CBE_ACCOUNT}\`
ዲፖዚት መጠን: ${amountDep} ብር

1\\. ከላይ ባለው ቁጥር ሲቢኢ  በመጠቀም  ${amountDep}ብር ያስገቡ
2\\. ብሩን ስትልኩ የከፈላችሁበትን መረጃ የያዘ አጭር የጹሁፍ መልክት\\(sms\\) ከ TeleBirr ይደርሳችኋል
3\\. የደረሳችሁን አጭር የጹሁፍ መለክት\\(sms\\) ሙሉዉን ኮፒ\\(copy\\) በማረግ ወደዚህ ቦት ይላኩ
⚠️ አስፈላጊ ማሳሰቢያ:
•1\\. ከTeleBirr የደረሳችሁን አጭር የጹሁፍ መለክት\\(sms\\) ሙሉዉን መላክ ያረጋግጡ
•2\\. ብር ማስገባት የምችሉት ከታች ባሉት አማራጮች ብቻ ነው
•     ከቴሌብር ወደ ኤጀንት ቴሌብር ብቻ
•     ከሲቢኢ ብር ወደ ኤጀንት ሲቢኢ ብር ብቻ`;
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
case "room_5":
case "room_50":
case "room_100":
case "room_10":
case "room_20":
case "room_30":
  const stake = parseInt(data.split("_")[1]);
  if (user.Wallet < stake) {
    bot.sendMessage(chatId, "⚠️ Not enough coins. Earn more to play.");
    return;
  }

  user.Wallet -= stake;
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
  break;
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
      historyText += `${i + 1}. via: ${t.type.toUpperCase()},type: ${t.method.toUpperCase()}, Amount: ${t.amount} ብር, Date: ${t.createdAt.toLocaleString()}\n`;
    });

    bot.sendMessage(chatId, historyText);
  } catch (err) {
    console.error(err);
    bot.sendMessage(chatId, "❌ Failed to fetch transaction history.");
  }
  break;

    default:
      bot.sendMessage(chatId, "Unknown action.");
  }
});
