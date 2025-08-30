require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

mongoose.connect(process.env.DATABASE_URL, {
  connectTimeoutMS: 30000, // 30 seconds
})
.then(() => console.log("MongoDB connected"))
.catch((e) => console.log(e));

// Transaction sub-schema
const transactionSchema = new mongoose.Schema({
  type: { type: String, enum: ["deposit", "withdraw"], required: true },
  method: { type: String, enum: ["telebirr", "cbebirr"], required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ["pending", "success", "failed"], default: "pending" },
  timestamp: { type: Date, default: Date.now },
});

// Main BingoBord schema
const BingoBordSchema = new mongoose.Schema({
  telegramId: {
    type: Number,   // or String, both work, I suggest Number since Telegram IDs are numbers
    
    unique: true
  },
  username: {
    type: String,
    required: true,
    unique: true
  },
  phoneNumber: {
    type: String,
    required: true,
    unique: true // prevents duplicate phone numbers
  },
  password: {                     // for admin login
    type: String,
    required: function() { return this.role === 'admin'; } // only required for admins
  },
  role: {
    type: String,
    enum: ['client', 'admin'],
    default: 'client'
  },
  Wallet: {
    type: Number,
    default: 200
  },
  coins: {
    type: Number,
    default: 0 // every new user starts with 0 coins
  },
  gameHistory: [
    {
      roomId: { type: Number, required: true }, 
      stake: { type: Number, required: true },
      outcome: { type: String, enum: ["win", "loss"], required: true }, 
      timestamp: { type: Date, default: Date.now }
    }
  ],
  transactions: [transactionSchema]
});

// Hash password before saving (only for admins)
BingoBordSchema.pre('save', async function(next) {
  if (this.role === 'admin' && this.isModified('password')) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
  next();
});

const BingoBord = mongoose.models.BingoBord || mongoose.model('BingoBord', BingoBordSchema);

module.exports = BingoBord;
