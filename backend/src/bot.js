require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const BingoBord = require('../Models/BingoBord');
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
        { text: "📥 Deposit", callback_data: "deposit" }
      ],
      [
        { text: "📤 Withdraw", callback_data: "withdraw" },
        { text: "📜 History", callback_data: "history" },
        { text: "ℹ️ Help", callback_data: "help" }
      ]
    ]
  }
};


const commands = [
  { command: "balance", callback_data: "balance",description: "💰 Check your balance" },
  { command: "play", callback_data: "play" ,description: "🎮 Play Bingo" },
  { command: "deposit", callback_data: "deposit",description: "📥 Deposit funds" },
  { command: "history", callback_data: "history",description: "📜 Transaction history" },
  { command: "help",callback_data: "help", description: "ℹ️ Help info" }
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
bot.onText(/\/(balance|play|deposit|history|help)/, async (msg, match) => {
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
        historyText += `${i + 1}. Room: ${g.roomId}, Stake: ${g.stake}, Outcome: ${g.outcome}, Date: ${g.timestamp?.toLocaleString() || "N/A"}\n`;
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
    { text: "Room 20 (Stake 20)", callback_data: "room_20" }
  ],
  [
    { text: "Room 30 (Stake 30)", callback_data: "room_30" },
    { text: "Room 50 (Stake 50)", callback_data: "room_50" },
    { text: "Room 100 (Stake 100)", callback_data: "room_100" }
  ]
]

        }
      });
  break;
  
      
    
    case "help":
      bot.sendMessage(chatId, "Use the menu to check balance, play games, or see your history.");

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
  if (step === "depositAmount") {
    const amount = parseFloat(text);
    if (isNaN(amount) || amount <= 0) {
      bot.sendMessage(chatId, "⚠️ Please enter a valid amount.");
      return;
    }
    userStates[chatId].amount = amount;

    bot.sendMessage(chatId, "💵 Click below to see deposit instructions:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Manual Deposit", callback_data: "manualDeposit" }]
        ]
      }
    });
    userStates[chatId].step = "depositMessage";
    return;
  }
if (step === "withdrawAmount") {
    const amount = parseFloat(text);
    if (isNaN(amount) || amount <= 0) {
      bot.sendMessage(chatId, "⚠️ Please enter a valid withdrawal amount.");
      return;
    }

    const method = userStates[chatId].method;

    try {
      const user = await BingoBord.findOne({ telegramId: chatId });
      if (!user) {
        bot.sendMessage(chatId, "User not found. Please /start first.");
        delete userStates[chatId];
        return;
      }

      const res = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/transactions/withdraw`, {
        username: user.username,
        phoneNumber: user.phoneNumber,
        amount,
        method
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

      const res = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/deposit`, {
        message: text,
        phoneNumber: user.phoneNumber
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
        historyText += `${i + 1}. Room: ${g.roomId}, Stake: ${g.stake}, Outcome: ${g.outcome}, Date: ${g.timestamp?.toLocaleString() || "N/A"}\n`;
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
    { text: "Room 20 (Stake 20)", callback_data: "room_20" }
  ],
  [
    { text: "Room 30 (Stake 30)", callback_data: "room_30" },
    { text: "Room 50 (Stake 50)", callback_data: "room_50" },
    { text: "Room 100 (Stake 100)", callback_data: "room_100" }
  ]
]

        }
      });
      break;

    case "help":
      bot.sendMessage(chatId, "Use the menu to check balance, play games, or see your history.");
      break;

    case "deposit":
      bot.sendMessage(chatId, "💵 How much money do you want to deposit?");
      userStates[chatId] = { step: "depositAmount" };
      break;

    case "manualDeposit":
      const amount = userStates[chatId]?.amount || "N/A";
      const instructions = `
የቴሌብር አካውንት
0932157512

Deposit Amount: ${amount} ብር
Follow instructions to complete deposit.
`;
      bot.sendMessage(chatId, instructions);
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

    case "room_10":
    case "room_20":
    case "room_30":
      const stake = parseInt(data.split("_")[1]);
      if (user.Wallet < stake) {
        bot.sendMessage(chatId, "⚠️ Not enough coins. Earn more to play.");
        return;
      }

      user.gameHistory.push({
        roomId: stake,
        stake: stake,
        outcome: "pending",
        timestamp: new Date()
      });
     // user.Wallet -= stake;
      await user.save();

      const webAppUrl = `${process.env.FRONTEND_URL}/CartelaSelction?username=${encodeURIComponent(user.username)}&telegramId=${user.telegramId}&roomId=${stake}&stake=${stake}`;
      bot.sendMessage(chatId, `✅ You joined Room ${stake}! ${stake} coins deducted. Click below to select your cartelas:`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: `Open Cartela Selection`, web_app: { url: webAppUrl } }]
          ]
        }
      });
      break;

    default:
      bot.sendMessage(chatId, "Unknown action.");
  }
});
