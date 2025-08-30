require('dotenv').config();  // Load .env
const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const BingoBord = require('../Models/BingoBord'); // your model

// Connect to MongoDB
mongoose.connect(process.env.DATABASE_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("MongoDB connected"))
.catch((e) => console.log(e));

// Create bot
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// Temporary user states
let userStates = {}; // { chatId: { step: "askName" } }

// ===== /start command =====
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  // Check if user already registered by telegramId
  const existingUser = await BingoBord.findOne({ telegramId: chatId });

  if (existingUser) {
    bot.sendMessage(chatId, `Welcome back, ${existingUser.username}!`);
    showMenu(chatId);
    return;
  }

  // New user, ask for username
  bot.sendMessage(chatId, "Welcome! Please enter your username:");
  userStates[chatId] = { step: "askName" };
});

// ===== Handle text messages =====
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // Ignore commands
  if (text.startsWith("/")) return;

  const state = userStates[chatId];
  if (!state) return; // no registration in progress

  try {
    if (state.step === "askName") {
      userStates[chatId].username = text;
      userStates[chatId].step = "askPhone";

      // Ask for phone number via contact button
      bot.sendMessage(chatId, "Great! Please share your phone number:", {
        reply_markup: {
          keyboard: [[{ text: "Share Contact", request_contact: true }]],
          resize_keyboard: true,
          one_time_keyboard: true,
        }
      });
    }
  } catch (err) {
    console.error(err);
    bot.sendMessage(chatId, "An error occurred. Please try again later.");
    delete userStates[chatId];
  }
});

// ===== Handle phone contact =====
bot.on('contact', async (msg) => {
  const chatId = msg.chat.id;
  const state = userStates[chatId];

  if (!state || state.step !== "askPhone") return;

  const phoneNumber = msg.contact.phone_number;
  const username = state.username;

  // Check if phone already registered
  const exists = await BingoBord.findOne({ phoneNumber });
  if (exists) {
    bot.sendMessage(chatId, "This phone number is already registered. Please /start again.");
    delete userStates[chatId];
    return;
  }

  // Save new user
  const newUser = new BingoBord({
    username,
    phoneNumber,
    telegramId: chatId,
    role: "client",
  });

  await newUser.save();
  bot.sendMessage(chatId, `Registration successful! Welcome, ${username}.`);

  delete userStates[chatId];
  showMenu(chatId);
});

// ===== Show menu after login/registration =====
function showMenu(chatId) {
  const menuKeyboard = {
    reply_markup: {
      keyboard: [
        ["🎮 Play Bingo", "💰 Check Wallet"],
        ["📜 Game History", "⚙️ Settings"]
      ],
      resize_keyboard: true,
      one_time_keyboard: true,
    }
  };
  bot.sendMessage(chatId, "What would you like to do?", menuKeyboard);
}

console.log("Telegram bot is running...");
