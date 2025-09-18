const BingoBord = require('../Models/BingoBord');
const  Transaction=require('../Models/Transaction');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { secretkey } = require('../config/jwtconfig');
const bot = require("../src/bot");
// Admin login
exports.adminLogin = async (req, res) => {
  try {
    const { username, password } = req.body;
    const admin = await BingoBord.findOne({ username, role: 'admin' });
    if (!admin) return res.status(401).json({ message: 'Admin not found' });

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) return res.status(401).json({ message: 'Wrong password' });

    const token = jwt.sign({ username, role: 'admin' }, secretkey, { expiresIn: '1d' });
    res.json({ message: 'Login successful', token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    // Get query params for pagination
    let { page = 1, limit = 10 } = req.query;
    page = parseInt(page, 10);
    limit = parseInt(limit, 10);

    const skip = (page - 1) * limit;

    // Fetch users with role client or admin
    const users = await BingoBord.find({ role: { $in: ['client', 'admin'] } })
      .select('-password') // Exclude password
      .skip(skip)
      .limit(limit);

    // Count total users with role client or admin
    const totalUsers = await BingoBord.countDocuments({ role: { $in: ['client', 'admin'] } });

    const totalPages = Math.ceil(totalUsers / limit);

    res.json({
      users,
      totalUsers,
      totalPages,
      currentPage: page,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};



// Get total deposits and withdrawals
exports.getTransactions = async (req, res) => {
  try {
    // Calculate total deposit amount
    const totalDeposit = await Transaction.aggregate([
      { $match: { method: 'deposit' } },
      { $group: { _id: null, totalAmount: { $sum: "$amount" } } }
    ]);

    // Calculate total withdrawal amount
    const totalWithdrawal = await Transaction.aggregate([
      { $match: { method: 'withdrawal' } },
      { $group: { _id: null, totalAmount: { $sum: "$amount" } } }
    ]);
    
    // Fetch all transactions to display in a list
    const transactions = await Transaction.find().sort({ createdAt: -1 }).limit(100);

    // Extract the total amounts, defaulting to 0 if no transactions are found
    const totalDepositAmount = totalDeposit.length > 0 ? totalDeposit[0].totalAmount : 0;
    const totalWithdrawalAmount = totalWithdrawal.length > 0 ? totalWithdrawal[0].totalAmount : 0;

    // Send a single response object that contains all the data your frontend needs
    res.json({ 
      totalDeposit: totalDepositAmount, 
      totalWithdraw: totalWithdrawalAmount,
      transactions: transactions // The list of transactions
    });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.registerUser = async (req, res) => {
  try {
    const { username, phoneNumber, password, role } = req.body;

    if (!username || !phoneNumber || !password || !role) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Check if username or phoneNumber exists
    const existing = await BingoBord.findOne({
      $or: [{ username }, { phoneNumber }]
    });
    if (existing) {
      return res.status(400).json({ message: 'Username or phone number already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new BingoBord({
      username,
      phoneNumber,
      password: hashedPassword,
      role, // client or admin
      Wallet: 0,
      coins: 0,
    });

    await newUser.save();
    res.json({ message: 'User registered successfully', user: { username, phoneNumber, role } });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

  exports.broadcastToAllCustomers = async (req, res) => {
    try {
        const allUsers = await BingoBord.find({}, 'telegramId');

        // The text message to broadcast
        const message = `
ውድ የአደይ ቢንጎ ቤተስቦች ዲፖሲት ብዙዎቻቹ ዲፖዚተት በመታድርጉ ጊዜ ችግር እንድ ጠማቹ ተግንዝበናል ማኑዋሉ ላይ ብሚግባ የትገለጸ ቢሆነም ብድምብ 
ለማብራራት ሲባል በሚክተለው ግሩፓችንና አጠቃቅሙ 
ባገባቡ ይሚግልጥ ሙሉ ቪድዮ ከታች ባለው ቴሌግራም ግሩፓቸን ላይ አስቅምጠንሎታል ${process.env.SUPPORT_GROUP}
ለበለጠ መረጃ ከታች ባለው ቻናላችን ያናግሩንበተጨማሪም
ሪፈራል ሊንክ ሲጠቀሙ በናንተ ሪፈራል የገባው ሰው ከሚያስቀምጠው10% 
ዲፖዚት ለናንተ ተጨማሪ ይሆናል ይህ ቀጣይነት ያለው እንጂ የአንድ ግዜ አደለም ለእገዛ ${process.env.SUPPORT_USERNAME}`;

        let successCount = 0;
        let failCount = 0;

        for (const user of allUsers) {
            if (user.telegramId) {
                try {
                    // ✅ UPDATED: Now using bot.sendMessage()
                    await bot.sendMessage(user.telegramId, message);
                    successCount++;
                } catch (error) {
                    console.error(`Failed to send message to user ${user.telegramId}:`, error.message);
                    failCount++;
                }
            }
        }

        console.log(`Broadcast completed. Messages sent to ${successCount} users, failed for ${failCount} users.`);

        return res.status(200).json({
            message: `Broadcast initiated. Messages sent to ${successCount} users, failed for ${failCount}.`
        });

    } catch (err) {
        console.error("Broadcast failed:", err);
        return res.status(500).json({ error: "Failed to broadcast message." });
    }
};  
// Register user (admin can choose role)

// Delete user by ID
exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const deleted = await BingoBord.findByIdAndDelete(userId);
    if (!deleted) return res.status(404).json({ message: 'User not found' });

    res.json({ message: 'User deleted successfully' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

