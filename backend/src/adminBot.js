require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

// YOUR MAIN GAME BOT (Existing)
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// YOUR NEW ADMIN BOT (Send-only, no polling needed)
const adminBot = new TelegramBot(process.env.ADMIN_BOT_TOKEN);
const ADMIN_ID = process.env.ADMIN_CHAT_ID;

// ... inside your withdrawAmount logic ...

if (step === "withdrawAmount") {
    // [Keep all your existing balance & axios code here exactly as it is]
    
    try {
        // ... (existing logic) ...
        
        // 1. YOUR ORIGINAL BACKEND CALL
        const res = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/transactions/withdraw`, {
            username: user.username,
            phoneNumber: user.phoneNumber,
            amount,
            method: 'withdrawal', 
            type: userStates[chatId].method
        });

        // 2. NEW: SEND ALERT TO THE ADMIN BOT
        const adminAlert = `
🏦 **WITHDRAWAL ALERT** 🏦
━━━━━━━━━━━━━━━━━━
👤 **User:** ${user.username}
📞 **Phone:** \`${user.phoneNumber}\`
💵 **Amount:** ${amount} Birr
🏛️ **Bank:** ${userStates[chatId].method.toUpperCase()}
🕒 **Time:** ${new Date().toLocaleString()}
━━━━━━━━━━━━━━━━━━
_Check your bank and process the payment._`;

        // We use adminBot to send the message
        await adminBot.sendMessage(ADMIN_ID, adminAlert, { parse_mode: 'Markdown' });

        // 3. YOUR ORIGINAL RESPONSE TO THE USER
        bot.sendMessage(chatId, res.data.message || "✅ Request submitted!");

    } catch (err) {
        bot.sendMessage(chatId, "❌ Error processing withdrawal.");
    }
    
    delete userStates[chatId];
    return;
}