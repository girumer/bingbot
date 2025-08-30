require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const BingoBord = require('../Models/BingoBord');

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
      [{ text: "💰 Balance", callback_data: "balance" }],
      [{ text: "🎮 Play", callback_data: "play" }],
      [{ text: "📜 History", callback_data: "history" }],
      [{ text: "ℹ️ Help", callback_data: "help" }]
    ]
  }
};

// ----------------------
// Temporary user states
// ----------------------
let userStates = {}; // { chatId: { step: "askName" | "askPhone" } }

// ----------------------
// /start command
// ----------------------
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  // check if user already exists by telegramId
  let user = await BingoBord.findOne({ telegramId: chatId });

  if (!user) {
    userStates[chatId] = { step: "askName" };
    bot.sendMessage(chatId, "Welcome! Please enter your name:");
  } else {
    bot.sendMessage(chatId, `Welcome back, ${user.username}!`, mainMenu);
  }
});
// ----------------------
// Handle normal text (registration flow)
// ----------------------
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!userStates[chatId]) return; // only handle if in registration flow

  const step = userStates[chatId].step;

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
  }
});

// ----------------------
// Handle contact
// ----------------------
bot.on("contact", async (msg) => {
  const chatId = msg.chat.id;
  const contact = msg.contact;

  if (userStates[chatId] && userStates[chatId].step === "askPhone") {
    // check if phone number already exists
    let existingUser = await BingoBord.findOne({ phoneNumber: contact.phone_number });
    if (existingUser) {
      bot.sendMessage(chatId, "⚠️ This phone number is already registered.");
      delete userStates[chatId];
      return;
    }

    const newUser = new BingoBord({
      telegramId: chatId,              // ✅ store telegramId
      username: userStates[chatId].name,
      phoneNumber: contact.phone_number,
      Wallet: 100, // default coins
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
        historyText += `${i + 1}. Room: ${g.roomId}, Stake: ${g.stake}, Outcome: ${g.outcome}, Date: ${g.timestamp.toLocaleString()}\n`;
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

    case "help":
      bot.sendMessage(chatId, "Use the menu to check balance, play games, or see your history.");
      break;

    // Handle room selection
    case "room_10":
    case "room_20":
    case "room_30":
      const stake = parseInt(data.split("_")[1]);
      if (user.Wallet < stake) {
        bot.sendMessage(chatId, "⚠️ Not enough coins. Earn more to play.");
        return;
      }

      // Deduct coins
      user.Wallet -= stake;
      user.gameHistory.push({
        roomId: stake,
        stake: stake,
        outcome: "pending"
      });
      await user.save();

      bot.sendMessage(chatId, `✅ You joined Room ${stake}! ${stake} coins deducted. Good luck!`, mainMenu);
      break;

    default:
      bot.sendMessage(chatId, "Unknown action.");
  }
});
