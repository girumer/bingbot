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
// Temporary user states
// ----------------------
let userStates = {}; // { chatId: { step: "askName" | "askPhone" | "depositAmount" | "depositMessage" } }

// ----------------------
// Main Menu
// ----------------------
const mainMenu = {
  reply_markup: {
    inline_keyboard: [
      [{ text: "💰 Balance", callback_data: "balance" }],
      [{ text: "🎮 Play", callback_data: "play" }],
      [{ text: "📥 Deposit", callback_data: "deposit" }],
      [{ text: "📜 History", callback_data: "history" }],
      [{ text: "ℹ️ Help", callback_data: "help" }]
    ]
  }
};

// ----------------------
// /start command
// ----------------------
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  // Ensure user state exists
  if (!userStates[chatId]) userStates[chatId] = {};

  // check if user already exists
  let user = await BingoBord.findOne({ telegramId: chatId });

  if (!user) {
    userStates[chatId].step = "askName";
    bot.sendMessage(chatId, "Welcome! Please enter your name:");
  } else {
    bot.sendMessage(chatId, `Welcome back, ${user.username}!`, mainMenu);
  }
});

// ----------------------
// Handle text messages
// ----------------------
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // Only handle if user is in a state
  if (!userStates[chatId] || !userStates[chatId].step) return;

  const step = userStates[chatId].step;

  // Step 1: Ask for Name
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

  // Step 2: Deposit amount
  if (step === "depositAmount") {
    const amount = parseFloat(text);
    if (isNaN(amount) || amount <= 0) {
      bot.sendMessage(chatId, "⚠️ Please enter a valid amount.");
      return;
    }

    if (!userStates[chatId]) userStates[chatId] = {};
    userStates[chatId].amount = amount;
    userStates[chatId].step = "depositMessage";

    bot.sendMessage(chatId, "💵 Click below to see deposit instructions:", {
      reply_markup: {
        inline_keyboard: [[{ text: "Manual Deposit", callback_data: "manualDeposit" }]]
      }
    });
    return;
  }

  // Step 3: User sends transaction message
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
      console.error(err);
      bot.sendMessage(chatId, err.response?.data?.error || "Failed to claim deposit.");
    }

    delete userStates[chatId];
    return;
  }
});

// ----------------------
// Handle contact sharing
// ----------------------
bot.on("contact", async (msg) => {
  const chatId = msg.chat.id;
  const contact = msg.contact;

  if (!userStates[chatId] || userStates[chatId].step !== "askPhone") return;

  const existingUser = await BingoBord.findOne({ telegramId: chatId });
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
});

// ----------------------
// Handle menu callback queries
// ----------------------
bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  // Ensure user state exists
  if (!userStates[chatId]) userStates[chatId] = {};

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
            [{ text: "Room 10 (Stake 10)", callback_data: "room_10" }],
            [{ text: "Room 20 (Stake 20)", callback_data: "room_20" }],
            [{ text: "Room 30 (Stake 30)", callback_data: "room_30" }]
          ]
        }
      });
      break;

    case "deposit":
      bot.sendMessage(chatId, "💵 How much money do you want to deposit?");
      userStates[chatId].step = "depositAmount";
      break;

    case "help":
      bot.sendMessage(chatId, "Use the menu to check balance, play games, or see your history.");
      break;

    case "manualDeposit":
      const amount = userStates[chatId]?.amount || "N/A";
      const instructions = `
የቴሌብር አካውንት
0932157512

1. ከላይ ባለው የቴሌብር አካውንት ${amount} ብር ያስገቡ
...
⚠️ ማሳሰቢያ፡ ዲፖዚት ባረጋቹ ቁጥር ቦቱ የሚያገናኛቹ ኤጀንቶች ስለሚለያዩ ከላይ ወደሚሰጣቹ የቴሌብር አካውንት ብቻ ብር መላካችሁን እርግጠኛ ይሁኑ።
      `;
      bot.sendMessage(chatId, instructions);
      userStates[chatId].step = "depositMessage";
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
      await user.save();

      const webAppUrl = `${process.env.FRONTEND_URL}/CartelaSelction?username=${encodeURIComponent(user.username)}&telegramId=${user.telegramId}&roomId=${stake}&stake=${stake}`;
      bot.sendMessage(chatId, `✅ You joined Room ${stake}! Click below to select your cartelas:`, {
        reply_markup: {
          inline_keyboard: [[{ text: "Open Cartela Selection", web_app: { url: webAppUrl } }]]
        }
      });
      break;

    default:
      bot.sendMessage(chatId, "Unknown action.");
  }
});
