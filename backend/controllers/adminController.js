const BingoBord = require('../Models/BingoBord');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { secretkey } = require('../config/jwtconfig');

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
    const users = await BingoBord.find({ role: 'client' });
    let totalDeposit = 0;
    let totalWithdraw = 0;

    users.forEach(user => {
      user.transactions.forEach(tx => {
        if (tx.type === 'deposit' && tx.status === 'success') totalDeposit += tx.amount;
        if (tx.type === 'withdraw' && tx.status === 'success') totalWithdraw += tx.amount;
      });
    });

    res.json({ totalDeposit, totalWithdraw });
  } catch (err) {
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

