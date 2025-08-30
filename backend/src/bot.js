require('dotenv').config();  // Load .env
const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const BingoBord = require('../Models/BingoBord'); // your model

// 1️⃣ Connect to MongoDB
mongoose.connect(process.env.DATABASE_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("MongoDB connected"))
.catch((e) => console.log("MongoDB connection error:", e));

// 2️⃣ Create the bot
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
console.log("Telegram bot is running...");

// 3️⃣ Temporary user state storage
let userStates = {}; // { chatId: { step: "askName" | "askContact", username } }

// 4️⃣ /start command
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    // Check if user already registered using Telegram ID
    const existingUser = await BingoBord.findOne({ telegramId: chatId });
    if (existingUser) {
      bot.sendMessage(chatId, `Welcome back, ${existingUser.username}! You are logged in.`);
      return;
    }

    // New user: ask for username
    bot.sendMessage(chatId, "Welcome! Please enter your username:");
    userStates[chatId] = { step: "askName" };
  } catch (err) {
    console.error(err);
    bot.sendMessage(chatId, "Error checking user. Please try again.");
  }
});

// 5️⃣ Listen for messages
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;

  // Ignore messages without text or contact
  if (!msg) return;

  const text = msg.text;
  const contact = msg.contact;
  const state = userStates[chatId];

  // Ignore messages if no ongoing registration
  if (!state) return;

  try {
    // Step 1: Ask username
    if (state.step === "askName" && text) {
      userStates[chatId].username = text.trim();
      userStates[chatId].step = "askContact";

      // Ask user to share contact
      bot.sendMessage(chatId, "Please share your contact (phone number) using the button below:", {
        reply_markup: {
          keyboard: [[{ text: "Share Contact", request_contact: true }]],
          one_time_keyboard: true,
          resize_keyboard: true
        }
      });
    }

    // Step 2: Receive contact
    else if (state.step === "askContact" && contact) {
      const phoneNumber = contact.phone_number;

      // Check if phone already exists
      const exists = await BingoBord.findOne({ phoneNumber });
      if (exists) {
        bot.sendMessage(chatId, "This phone number is already registered. Please /start again.");
        delete userStates[chatId];
        return;
      }

      // Save user in MongoDB
      const username = userStates[chatId].username;
      const newUser = new BingoBord({
        username,
        phoneNumber,
        role: "client",
        telegramId: chatId, // store Telegram ID
        Wallet: 0,
        coins: 0,
        gameHistory: [],
        transactions: []
      });
      await newUser.save();

      bot.sendMessage(chatId, `Registration successful! Welcome, ${username}.`);
      delete userStates[chatId];
    }
  } catch (err) {
    console.error(err);
    bot.sendMessage(chatId, "An error occurred. Please try again.");
    delete userStates[chatId];
  }
});
