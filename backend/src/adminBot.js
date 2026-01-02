require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios'); // Ensure axios is required

// YOUR MAIN GAME BOT
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// YOUR NEW ADMIN BOT
const adminBot = new TelegramBot(process.env.ADMIN_BOT_TOKEN);
const ADMIN_ID = process.env.ADMIN_CHAT_ID;

// Use a shared state object
let userStates = {};

// We MUST wrap the logic in an 'async' function to use 'await'
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    // Safety check for production: Ensure state exists
    if (!userStates[chatId]) return;

    const step = userStates[chatId].step;

    if (step === "withdrawAmount") {
        const amount = parseFloat(text);
        
        // Basic Validation
        if (isNaN(amount) || amount <= 0) {
            return bot.sendMessage(chatId, "⚠️ Please enter a valid amount.");
        }

        try {
            // 1. YOUR ORIGINAL BACKEND CALL
            // Make sure your .env has REACT_APP_BACKEND_URL
            const res = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/transactions/withdraw`, {
                username: "User", // You'll need to fetch the real user from DB here
                phoneNumber: "Phone", 
                amount,
                method: 'withdrawal', 
                type: userStates[chatId].method || 'telebirr'
            });

            // 2. SEND ALERT TO THE ADMIN BOT
            const adminAlert = `
🏦 **WITHDRAWAL ALERT** 🏦
━━━━━━━━━━━━━━━━━━
👤 **User:** ${chatId}
💵 **Amount:** ${amount} Birr
🏛️ **Bank:** ${(userStates[chatId].method || 'N/A').toUpperCase()}
🕒 **Time:** ${new Date().toLocaleString()}
━━━━━━━━━━━━━━━━━━`;

            // Production Safety: Catch admin bot errors separately so main bot doesn't die
            await adminBot.sendMessage(ADMIN_ID, adminAlert, { parse_mode: 'Markdown' })
                .catch(e => console.error("Admin notification failed:", e.message));

            // 3. ORIGINAL RESPONSE TO THE USER
            bot.sendMessage(chatId, res.data.message || "✅ Request submitted!");

        } catch (err) {
            console.error("Production Withdrawal Error:", err.message);
            bot.sendMessage(chatId, "❌ Error processing withdrawal.");
        }
        
        delete userStates[chatId];
        return;
    }
});

console.log("🚀 Production Bot is running...");