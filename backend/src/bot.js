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
const commands = [
  { command: "balance",callback_data: "balance" , description: "💰 Check your balance" },
  { command: "play", callback_data: "play",description: "🎮 Play Bingo" },
  { command: "deposit", callback_data: "deposit",description: "📥 Deposit funds" },
  { command: "history", callback_data: "deposit",description: "📜 Transaction history" },
  { command: "help", callback_data: "deposit",description: "ℹ️ Help info" }
];
bot.setMyCommands(commands)
  .then(() => console.log("Bot menu commands set successfully"))
  .catch(console.error);

  let userStates = {};
async function handleAction(chatId, action) {
  const user = await BingoBord.findOne({ telegramId: chatId });

  // Registration check
  if (!user && !["askName","askPhone","depositAmount","depositMessage"].includes(userStates[chatId]?.step)) {
    bot.sendMessage(chatId, "You are not registered. Use /start to register.");
    return;
  }

  switch (action) {
    case "balance":
      bot.sendMessage(chatId, `💰 Your balance: ${user.Wallet} coins`);
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
      userStates[chatId] = { step: "depositAmount" };
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

    case "help":
      bot.sendMessage(chatId, "Use the menu to check balance, play games, or see your history.");
      break;

    // Inline buttons like rooms or manual deposit
   
case "manualDeposit":
  const amount = userStates[chatId]?.amount || "N/A";
  const instructions = `የቴሌብር አካውንት
0968857386
1. ከላይ ባለው የቴሌብር አካውንት 50ብር ያስገቡ

2. የምትልኩት የገንዘብ መጠን እና እዚ ላይ እንዲሞላልዎ የምታስገቡት የብር መጠን ተመሳሳይ መሆኑን እርግጠኛ ይሁኑ

3. ብሩን ስትልኩ የከፈላችሁበትን መረጃ የያዝ አጭር የጹሁፍ መልክት(sms) ከቴሌብር ይደርሳችኋል

4. የደረሳችሁን አጭር የጹሁፍ መለክት(sms) ሙሉዉን ኮፒ(copy) በማረግ ከታሽ ባለው የቴሌግራም የጹሁፍ ማስገቢአው ላይ ፔስት(paste) በማረግ ይላኩት 
ማሳሰቢያ፡ ዲፖዚት ባረጋቹ ቁጥር ቦቱ የሚያገናኛቹ ኤጀንቶች ስለሚለያዩ ከላይ ወደሚሰጣቹ የቴሌብር አካውንት ብቻ ብር መላካችሁን እርግጠኛ ይሁኑ። ዲፖዚት ስታረጉ ቦቱ ከሚያገናኛቹ ኤጀንት ዉጪ ወደ ሌላ ኤጀንት ብር ከላካቹ ቦቱ 2% ቆርጦ ይልክላችኋል። `;
  bot.sendMessage(chatId, instructions);

  if (!userStates[chatId]) userStates[chatId] = {}; // ✅ ensure object exists
  userStates[chatId].step = "depositMessage";
  break;
    case "room_10":
    case "room_20":
    case "room_30":
      let stake = parseInt(action.split("_")[1]);
      if (user.Wallet < stake) {
        bot.sendMessage(chatId, "⚠️ Not enough coins. Earn more to play.");
        return;
      }

      user.Wallet -= stake;
      user.gameHistory.push({
        roomId: stake,
        stake,
        outcome: "pending",
        timestamp: new Date()
      });
      await user.save();

      const webAppUrl = `${process.env.FRONTEND_URL}/CartelaSelction?username=${encodeURIComponent(user.username)}&telegramId=${user.telegramId}&roomId=${stake}&stake=${stake}`;
      bot.sendMessage(chatId, `✅ You joined Room ${stake}! Click below to select your cartelas:`, {
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
}

bot.onText(/\/(.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const cmd = match[1];
  handleAction(chatId, cmd);
});

bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;
  await handleAction(chatId, data);
});
// ----------------------
// Temporary user states
// ----------------------
 // { chatId: { step: "askName" | "askPhone" } }

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

  if (!userStates[chatId]) return; // only handle if user is in registration/deposit flow

  const step = userStates[chatId].step;

  // -------------------------------
  // Step 1: Ask for Name (Registration)
  // -------------------------------
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

  // -------------------------------
  // Step 2: Ask for Deposit Amount
  // -------------------------------
  if (step === "depositAmount") {
    const amount = parseFloat(text);
    if (isNaN(amount) || amount <= 0) {
      bot.sendMessage(chatId, "⚠️ Please enter a valid amount.");
      return;
    }

    // Save the amount in userStates
    userStates[chatId].amount = amount;

    // Show manual deposit button
    bot.sendMessage(chatId, "💵 Click below to see deposit instructions:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Manual Deposit", callback_data: "manualDeposit" }]
        ]
      }
    });

    // Move to next step: wait for transaction message
    userStates[chatId].step = "depositMessage";
    return;
  }

  // -------------------------------
  // Step 3: User Sends Transaction Message
  // -------------------------------
  if (step === "depositMessage") {
    try {
      const user = await BingoBord.findOne({ telegramId: chatId });
      if (!user) {
        bot.sendMessage(chatId, "User not found. Please /start first.");
        return;
      }

      // Call your deposit API
      const res = await axios.post( `${process.env.REACT_APP_BACKEND_URL}/api/deposit`, {
        message: text,
        phoneNumber: user.phoneNumber
      });

      bot.sendMessage(chatId, res.data.message || "Deposit claimed successfully! 🎉");
    } catch (err) {
      console.error(err);
      bot.sendMessage(chatId, err.response?.data?.error || "Failed to claim deposit.");
    }

    // Clear state after deposit is handled
    delete userStates[chatId];
    return;
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
   let existingUser = await BingoBord.findOne({ telegramId: chatId });
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
 handleAction(chatId, data);

});

