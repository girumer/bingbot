 require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

const express = require("express")
const async = require('async');
const cartela = require('./cartela.json');
const BingoBord=require("../Models/BingoBord")
const crypto = require('crypto');
const Transaction = require("../Models/Transaction");
const jwt=require('jsonwebtoken')
const cors = require("cors")
const TelegramBot = require('node-telegram-bot-api');
const bcrypt = require('bcryptjs');
const { deductWallet } = require('../controllers/walletController');
const cookieParser = require('cookie-parser');
const authRoutes = require('../routes/authRoutes');


const adminsRoutes = require("../routes/admins");
const userRoutes = require('../routes/userRoutes');
const walletRoutes = require("../routes/walletRoutes");
const alluserRoutes = require('../routes/alluserRoutes');
const authRoutessignup= require('../routes/signupauthRoutes');
const gameHistoryRoutes = require("../routes/gameHistory");
const depositRoutes = require('../routes/depositRoutes');
const adminRoutes = require('../routes/admin');
const authRouter = require('../routes/auth');
const reportRoutes = require('../routes/reportRoutes');
const transactionRoutes = require("../routes/transactionRoutes");
const transactionRoutesd = require("../routes/transaction");
const path = require('path');
const secretkey=process.env.JWT_SECRET;
const refreshKey=process.env.JwT_PRIVATE;


const bodyParser=require("body-parser")
const saveHistoryRoutes = require("../routes/saveHistory"); // adjust path


//const workoutrouter=require("./src/Routes/Users");

const app = express()
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser());
app.use("/manifest.json", express.static("public/manifest.json"));
const http=require("http");


const server=http.createServer(app);
//to be exported  


app.use(bodyParser.json());
const { Server } = require("socket.io");
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "http://localhost:3000",
      "http://167.235.140.218",
      "http://adeyebingo.com",
      "http://adeyebingo.com",
      "http://www.adeyebingo.com",
      "http://www.adeyebingo.com",
      "http://api.adeyebingo.com"
    ],
    methods: ["GET", "POST"],
    credentials: true
  }
});


const allowedOrigins = [
  'http://localhost:3000',
  'https://localhost:3000',
  'http://167.235.140.218',
  'http://adeyebingo.com',
  'https://adeyebingo.com',
  'http://www.adeyebingo.com',
  'https://www.adeyebingo.com',
  
  // ADD THESE TWO LINES:
  'http://api.adeyebingo.com',    // ← ADD THIS (HTTP)
  'https://api.adeyebingo.com',   // ← YOU ALREADY HAVE THIS
  
  // ... rest of your origins
];
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));






// backend/routes/adminRoutes.js

const router = express.Router();

// Example: fetch all transactions with pagination




// Enable handling of OPTIONS requests (for preflight)
// Automatically handle OPTIONS requests

/* const createToken=(_id)=>{
 return   jwt.sign({_id}, process.env.JWT_SECRET,{expiresIn:'3d'})
} */


 // your setup



// adjust path if your model is elsewhere


 // Your cartela data






const rooms = {}; // rooms = { roomId: { players, selectedIndexes, playerCartelas, ... } }
const socketIdToClientId = new Map();
const clientIdToSocketId = new Map();

io.on("connection", (socket) => {
  console.log("New connection:", socket.id);

  // --- JOIN ROOM ---
  socket.on("joinRoom", ({ roomId, username, telegramId, clientId }) => {
    const rId = String(roomId);
    socket.join(rId);

    // ✅ Map socketId to clientId
    socketIdToClientId.set(socket.id, clientId);
    clientIdToSocketId.set(clientId, socket.id);

    if (!rooms[rId]) {
      rooms[rId] = {
        players: {},
        selectedIndexes: [],
        playerCartelas: {},
        timer: null,
        calledNumbers: [],
        numberInterval: null,
        alreadyWon: [],
        totalAward: 0,
        gameId: 0,
      };
      console.log(`Room created: ${rId}`);
    }

    // ✅ Use clientId as the key for all player info
   rooms[rId].players[clientId] = username || `Guest-${clientId}`;
 

    // ✅ Ensure player has a cartela slot
    if (!rooms[rId].playerCartelas[clientId]) {
      rooms[rId].playerCartelas[clientId] = [];
    }
    const myCartelas = rooms[rId].playerCartelas[clientId];

    // ✅ Emit state to this player
    socket.emit("currentGameState", {
      calledNumbers: rooms[rId].calledNumbers,
      myCartelas,
      selectedIndexes: rooms[rId].selectedIndexes,
      lastNumber: rooms[rId].calledNumbers.slice(-1)[0] || null,
      timer: rooms[rId].timer,
      totalAward: rooms[rId].totalAward,
      totalPlayers: Object.keys(rooms[rId].players).length,
      activeGame: rooms[rId].activeGame || false,
    });

    // ✅ Broadcast updated player count
    const activePlayers = Object.values(rooms[rId].playerCartelas).filter(
      (arr) => arr.length > 0
    ).length;
    io.to(rId).emit("playerCount", { totalPlayers: activePlayers });

    console.log(`New connection: ${socket.id}, username=${username}, telegramId=${telegramId}, clientId=${clientId}`);
  });

  // --- SELECT CARTELA ---
  socket.on("selectCartela", async ({ roomId, cartelaIndex }) => {
    const rId = String(roomId);
    
    // ✅ CORRECT: Get clientId from the global map using the socket.id
    const clientId = socketIdToClientId.get(socket.id);
    if (!clientId) {
      socket.emit("cartelaRejected", { message: "Client ID not found. Please refresh." });
      return;
    }

    if (!rooms[rId] || rooms[rId].selectedIndexes.includes(cartelaIndex)) {
      socket.emit("cartelaRejected", {
        message: "Cartela already taken or room not found",
      });
      return;
    }

    try {
      // ✅ CORRECT: Get username directly from the rooms object using clientId
      const username = rooms[rId].players[clientId];
      if (!username) {
        socket.emit("cartelaRejected", { message: "User not found in room" });
        return;
      }

      const user = await BingoBord.findOne({ username });
      const stake = Number(rId);

      if (!user || user.Wallet < stake) {
        socket.emit("cartelaRejected", { message: "Insufficient balance or user not found" });
        return;
      }

      // ✅ Use clientId to get cartela array
      if (!rooms[rId].playerCartelas[clientId])
        rooms[rId].playerCartelas[clientId] = [];
      const userCartelas = rooms[rId].playerCartelas[clientId];

      // Limit per user to 4 cartelas
      if (userCartelas.length >= 4) {
        socket.emit("cartelaRejected", { message: "You can only select up to 4 cartelas" });
        return;
      }

      user.Wallet -= stake;
      await user.save();

      userCartelas.push(cartelaIndex);
      rooms[rId].selectedIndexes.push(cartelaIndex);

      socket.emit("cartelaAccepted", { cartelaIndex, Wallet: user.Wallet });
      console.log("caretela accepted now");
      io.to(rId).emit("updateSelectedCartelas", {
        selectedIndexes: rooms[rId].selectedIndexes,
      });

      const playersWithCartela = Object.values(rooms[rId].playerCartelas).filter(
        (arr) => arr.length > 0
      ).length;
      if (!rooms[rId].timer && playersWithCartela >= 2) {
        startCountdown(rId, 30);
      }
    } catch (err) {
      console.error("Error selecting cartela:", err);
      socket.emit("cartelaRejected", { message: "Server error" });
    }
  });


  // --- CALL NUMBER ---
  socket.on("callNumber", ({ roomId, number }) => {
    if (!rooms[roomId]) return;
    const room = rooms[roomId];
    if (!room.calledNumbers.includes(number)) room.calledNumbers.push(number);

    io.to(roomId).emit("numberCalled", number);
    io.to(roomId).emit(
      "currentCalledNumbers",
      room.calledNumbers.slice(-5).reverse()
    );
    io.to(roomId).emit("updateSelectedCartelas", {
      selectedIndexes: room.selectedIndexes,
    });

    checkWinners(roomId, number);
  });



  // --- DISCONNECT ---
  socket.on("disconnect", () => {
    // ✅ Get the clientId for the disconnecting socket
    const clientId = socketIdToClientId.get(socket.id);
    if (!clientId) return; // Ignore if client ID is not found

    // ✅ Clean up the global maps
    socketIdToClientId.delete(socket.id);
    clientIdToSocketId.delete(clientId);

    // ✅ Clean up from rooms based on clientId
    for (const roomId in rooms) {
      if (rooms[roomId]?.players?.[clientId]) {
        delete rooms[roomId].players[clientId];
        io.to(roomId).emit("updateSelectedCartelas", {
          selectedIndexes: rooms[roomId].selectedIndexes,
        });
        io.to(roomId).emit("playerCount", {
          totalPlayers: Object.keys(rooms[roomId].players).length,
        });
      }
    }
  });
});

// ================= GAME FUNCTIONS =================
function startNumberGenerator(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  const playersWithCartela = Object.values(room.playerCartelas).filter(
    (arr) => arr.length > 0
  ).length;
  if (playersWithCartela < 1) return;
  if (!Array.isArray(room.calledNumbers)) room.calledNumbers = [];
  const numbers = Array.from({ length: 75 }, (_, i) => i + 1);
  for (let i = numbers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
  }
  let index = 0;
  room.numberInterval = setInterval(() => {
    if (!rooms[roomId]) return;
    if (index >= numbers.length) {
      clearInterval(room.numberInterval);
      room.numberInterval = null;
      return;
    }
    const nextNumber = numbers[index++];
    if (!room.calledNumbers.includes(nextNumber))
      room.calledNumbers.push(nextNumber);
    io.to(roomId).emit("numberCalled", nextNumber);
    io.to(roomId).emit("currentCalledNumbers", room.calledNumbers.slice(-5).reverse());
    checkWinners(roomId, nextNumber);
  }, 4000);
}
function generateGameId() {
  let newGameId;
  let isUnique = false;
  while (!isUnique) {
    newGameId = Math.floor(Math.random() * 90000) + 10000;
    let idExists = false;
    for (const roomId in rooms) {
      if (rooms[roomId].gameId === newGameId) {
        idExists = true;
        break;
      }
    }
    if (!idExists) {
      isUnique = true;
    }
  }
  return newGameId;
}
function startCountdown(roomId, seconds) {
  if (!rooms[roomId]) return;
  let timeLeft = seconds;
  if (rooms[roomId].timer) return;
  rooms[roomId].timer = timeLeft;
  rooms[roomId].numberInterval = setInterval(async () => {
    timeLeft -= 1;
    rooms[roomId].timer = timeLeft;
    io.to(roomId).emit("startCountdown", timeLeft);
    if (timeLeft <= 0) {
      clearInterval(rooms[roomId].numberInterval);
      rooms[roomId].timer = null;
      const room = rooms[roomId];
      
      // ✅ Corrected loop to send myCartelas
      for (const clientId in room.playerCartelas) {
        const socketId = clientIdToSocketId.get(clientId);
        if (socketId) {
            const myCartelas = room.playerCartelas[clientId] || [];
            if (myCartelas.length > 0) {
                io.to(socketId).emit("myCartelas", myCartelas);
            }
        }
      }
        room.gameId =generateGameId();
      room.activeGame = true;
      io.to(roomId).emit("activeGameStatus", { activeGame: true   });

      const totalCartelas = Object.values(room.playerCartelas).reduce(
        (sum, arr) => sum + arr.length,
        0
      );
      room.totalAward = totalCartelas * Number(roomId) * 0.8;
      io.to(roomId).emit("gameStarted", {
        totalAward: room.totalAward,
        totalPlayers: Object.keys(room.players).length,
         gameId: room.gameId ,
      });
    console.log("game id is ",room.gameId);
      startNumberGenerator(roomId);
    }
  }, 1000);
}

// --- WIN LOGIC ---
function findWinningPattern(cartelaData, calledNumbers) {
  if (!cartelaData) return null;
  for (let i = 0; i < 5; i++) {
    if (cartelaData[i].every((num) => calledNumbers.includes(num) || num === "*"))
      return cartelaData[i];
    const col = cartelaData.map((row) => row[i]);
    if (col.every((num) => calledNumbers.includes(num) || num === "*"))
      return col;
  }
  const diag1 = [0, 1, 2, 3, 4].map((i) => cartelaData[i][i]);
  const diag2 = [0, 1, 2, 3, 4].map((i) => cartelaData[i][4 - i]);
  if (diag1.every((num) => calledNumbers.includes(num) || num === "*"))
    return diag1;
  if (diag2.every((num) => calledNumbers.includes(num) || num === "*"))
    return diag2;
  const corners = [
    cartelaData[0][0],
    cartelaData[0][4],
    cartelaData[4][0],
    cartelaData[4][4],
  ];
  if (corners.every((num) => calledNumbers.includes(num) || num === "*"))
    return corners;
  const innerCorners = [
    cartelaData[1][1],
    cartelaData[1][3],
    cartelaData[3][1],
    cartelaData[3][3],
  ];
  if (innerCorners.every((num) => calledNumbers.includes(num) || num === "*"))
    return innerCorners;
  return null;
}

async function saveGameHistory(username, roomId, stake, outcome,  gameId ) {
  try {
    const user = await BingoBord.findOne({ username });
    if (!user) return;
    user.gameHistory.push({
      roomId: Number(roomId),
      stake: Number(stake),
      outcome,
      timestamp: new Date(),
      gameId,
    });
    await user.save();
  } catch (err) {
    console.error("Failed to save game history:", err);
  }
}

async function checkWinners(roomId, calledNumber) {
  const room = rooms[roomId];
  if (!room) return;
  const winners = [];
  for (const clientId in room.playerCartelas) {
    const cartelas = room.playerCartelas[clientId];
    if (!cartelas || cartelas.length === 0) continue;

    // ✅ CORRECT: Get username directly from the players object using clientId
    const username = room.players[clientId];
    if (!username) continue;
    
    for (const cartelaIndex of cartelas) {
      if (!cartela[cartelaIndex]) continue;
      const key = clientId + "-" + cartelaIndex;
      if (room.alreadyWon.includes(key)) continue;
      const pattern = findWinningPattern(
        cartela[cartelaIndex].cart,
        room.calledNumbers
      );
      if (pattern) {
        winners.push({ clientId, cartelaIndex, pattern, winnerName: username });
        room.alreadyWon.push(key);
      }
    }
  }

  if (winners.length > 0) {
    if (room.numberInterval) {
      clearInterval(room.numberInterval);
      room.numberInterval = null;
    }
    const awardPerWinner = Math.floor(room.totalAward / winners.length);

    for (const winner of winners) {
      const user = await BingoBord.findOne({ username: winner.winnerName });
      if (user) {
        user.Wallet += awardPerWinner;
        user.coins += 1;
        await user.save();
        await saveGameHistory(winner.winnerName, roomId, awardPerWinner, "win", room.gameId);
      }
    }
    
    for (const clientId in room.playerCartelas) {
      const cartelas = room.playerCartelas[clientId];
      if (!cartelas || cartelas.length === 0) continue;
      
      const username = room.players[clientId];
      if (!username) continue;
      
      if (!winners.some((w) => w.winnerName === username)) {
        await saveGameHistory(username, roomId, Number(roomId), "loss", room.gameId);
      }
    }

    io.to(roomId).emit("winningPattern", winners);

    setTimeout(() => {
      if (rooms[roomId]) {
        const room = rooms[roomId];
        room.activeGame = false;
        room.selectedIndexes = [];
        room.playerCartelas = {};
        room.calledNumbers = [];
        room.alreadyWon = [];
        room.totalAward = 0;
        io.to(roomId).emit("roomAvailable");
        io.to(roomId).emit("resetRoom");
      }
    }, 4000);
  }
}

 
 app.get('/', (req, res) => {
  res.json({ message: 'Hello, world! ass i know ' }); // Sends a JSON response
});
  const verfyuser = async (req, res, next) => {
    const accesstoken = req.cookies.accesstoken;
  
    if (!accesstoken) {
      // Renew the token
      const renewToken = (req, res, next) => {
        // Logic to renew the token if expired
        const newToken = jwt.sign({ username: req.username, role: req.role }, secretkey, { expiresIn: '1h' });
        res.cookie('accesstoken', newToken, { httpOnly: false });
        next(); // Proceed to next middleware
      };
      
      // Let renewToken handle the response or call next()
    } else {
      jwt.verify(accesstoken, secretkey, (err, decoded) => {
        if (err) {
          return res.json({ valid: false, message: "Invalid token" });
        } else {
          req.username = decoded.username;
          req.role=decoded.role;
          next(); // Proceed to the next middleware
        }
      });
    }
  };

  app.get('/api', (req, res) => {
    res.send('API is working!');
  });
  app.get('/api/test-endpoint', (req, res) => {
  res.json({ message: "API is working!" });
});
  app.use('/auth', authRoutes);
app.use('/user', userRoutes);

app.use('/api', reportRoutes);
app.use('/auth', authRoutessignup);
app.use('/api', gameHistoryRoutes);
app.use('/api', depositRoutes);
app.use("/api/admins", adminsRoutes);
app.use('/api', alluserRoutes);

app.use("/api/transactions", transactionRoutes);
app.use("/api/gameHistory", gameHistoryRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api", transactionRoutesd);
app.use('/admin', adminRoutes);

app.use('/auth', authRouter);
app.post("/deleteuser",async(req,res)=>{
    const{username}=req.body
  
    
    try{
        //const check=await BingoBord.findOne({username:username})
  
      const existinguser=await BingoBord.findOne({username})
      console.log(username);
      if(!existinguser){
        return res.status(404).json({ success: false, message: "User not found" });
      }
      await BingoBord.deleteOne({ username });

      res.status(200).json({ success: true, message: "User successfully deleted" });
  
    }
    catch(e){
      console.error("Error during user deletion:", e);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  
  })
  app.post("/updatewallete", async (req, res) => { 
    const {tempuser,incaamount} = req.body;
  
    
    try {
        // Find if the player already exists
        const check = await BingoBord.findOne({ username: tempuser });
        console.log("user is ",check);
          
        if (check) {
         // Retrieve the last gameId from gameHistory if it exists, otherwise start from 0
             // Increment gameId
            
            const filter = { username:  tempuser };
            const update = {
                $inc: { Wallet: incaamount}// Deduct from Wallet
               
                
                } // Push new game history entry
           
  
            const result = await BingoBord.updateOne(filter, update);
            if (result.matchedCount === 0) {
                console.log("No documents matched the filter.");
            } else if (result.modifiedCount === 0) {
                console.log("Document was found, but no updates were made.");
            } else {
                console.log("Document updated successfully.");
            }
            return res.json("updated");
          }// Send response after successful update
        else {
            // If player does not exist, insert data and respond
            await BingoBord.insertMany([data]); // Ensure collection is defined correctly here
            return res.json("notexist");
        }
    } catch (e) {
        console.error("Database error:", e); // Log the error
        if (!res.headersSent) { // Ensure response is sent only once
            res.json("fail");
        }
    }
  });


// routes/admin.js

// Register Admin (only once)



// API: Receive SMS message (TeleBirr or CBE) and store transaction

app.get("/admin/transactions-list", async (req, res) => {
  try {
    const transactions = await Transaction.find({ method: "depositpend" })
      .sort({ createdAt: -1 })
      .limit(300); // latest 50
    res.json(transactions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});
app.get("/admin/pending-withdrawals",  async (req, res) => {
  try {
    const pendingWithdrawals = await Transaction.find({ method: "withdrawal"}).sort({ createdAt: -1 });
    res.json(pendingWithdrawals);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});
app.get("/admin/deposit",  async (req, res) => {
  try {
    const pendingdeposit = await Transaction.find({ method: "deposit"}).sort({ createdAt: -1 });
    res.json(pendingdeposit);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/admin/confirm-withdrawal", async (req, res) => {
  const {withdrawalId} = req.body;
  try {
    const transaction = await Transaction.findOne({withdrawalId});
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found." });
    }
    
else{
 await Transaction.deleteOne({withdrawalId});
    res.status(200).json({ success: true, message: "Withdrawal confirmed successfully." });
}
    

    // Check again for sufficient funds just in case
    

   
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});
app.post("/admin/confirm-depo", async (req, res) => {
  const {depositId} = req.body;
  try {
    const transaction = await Transaction.findOne({depositId});
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found." });
    }
    
else{
 await Transaction.deleteOne({depositId});
    res.status(200).json({ success: true, message: "Withdrawal confirmed successfully." });
}
    

    // Check again for sufficient funds just in case
    

   
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});
router.post("/admin/reject-withdrawal",  async (req, res) => {
  const { transactionId } = req.body;
  try {
    const transaction = await Transaction.findById(transactionId);
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found." });
    }
    if (transaction.status !== "pending") {
      return res.status(400).json({ message: "Transaction is not pending." });
    }

    // Update the transaction status to 'rejected'
    transaction.status = "rejected";
    transaction.rawMessage = `Withdrawal rejected by admin at ${new Date().toLocaleString()}`;
    await transaction.save();

    res.json({ message: "Withdrawal rejected successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

const getUsernameFromToken = (req, res, next) => {
  const accessToken = req.headers.authorization && req.headers.authorization.split(' ')[1];
//console.log(accessToken);
  if (!accessToken) {
    return res.status(401).json({ valid: false, message: 'Access token not provided' });
  }
  

  jwt.verify(accessToken, secretkey, (err, decoded) => {
    if (err) {
      return res.status(403).json({ valid: false, message: 'Invalid access token' });
    }
    
    // Attach username to the request object
    req.username = decoded.username;
    req.role=decoded.role;
   
    next();
  });
};


app.post("/useracess",getUsernameFromToken,(req,res)=>{
  res.json({ valid: true, username: req.username ,role:req.role, phoneNumber:req.phoneNumber});
  //console.log("hay",req.username,req.role);
})
app.post("/loginacess",getUsernameFromToken,(req,res)=>{
 
  res.json({ valid: true, username: req.username,role:req.role,phoneNumber:req.phoneNumber });
}
) 
 app.post("/depositcheckB", async (req, res) => {
    const { telegramId } = req.body;
    console.log("Checking balance for Telegram ID:", telegramId);

    if (!telegramId) {
        return res.status(400).json({ error: "Telegram ID is required." });
    }

    try {
        // Correctly find the user using the unique telegramId
        const data1 = await BingoBord.findOne({ telegramId: telegramId });

        if (data1) {
            const depo1 = parseInt(data1.Wallet);
            res.json( depo1 ); // Corrected line
            console.log("User found. Balance is:", depo1);
        } else {
            // Send a specific message if the user is not found
            res.status(404).json({ error: "User not found." });
            console.log("User with Telegram ID", telegramId, "not found.");
        }
    } catch (e) {
        console.error("Error during balance check:", e);
        res.status(500).json({ error: "Internal server error." });
    }
});
app.get("/dashboard", verfyuser, async (req, res) => {
  console.log("Dashboard route hit");
  try {
    const user = await BingoBord.find({});
    console.log("All users are:", user);
    return res.json({ valid: true, user: user });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ valid: false, message: "Error fetching users" });
  }
});
/* app.get("/dashboard",verfyuser,async(req,res)=>{
  //const{username,password}=req.body
     
     const user=await BingoBord.find({})
     console.log("all users are", user);
    return  res.json({valid:true ,user:user});
    
}) */
app.post("/updateplayer", async (req, res) => { 
  const { username,stake,numberofplayer,profit,awardforagent,totalcash,venderaward,winerAward,percent } = req.body;

  const data = {
      username: username,
      numberofplayer:numberofplayer,
      profit:profit,
      stake: stake,
      totalcash: totalcash,
      venderaward: venderaward,
      winerAward:winerAward,
      awardforagent:awardforagent,
      percent:percent
  };

  try {
      // Find if the player already exists
      const check = await BingoBord.findOne({ username: username });
     // console.log("user is ",check);
        console.log("winer awared is ",winerAward);
      if (check) {
       // Retrieve the last gameId from gameHistory if it exists, otherwise start from 0
let depo1 = (check.gameHistory.length > 0) 
? check.gameHistory[check.gameHistory.length - 1].gameId + 1 
: 1;
        console.log( check.gameId);
           depo1 =depo1+1;// Increment gameId
          const PayeForVendor = venderaward;
          
          const waletdeuction = -venderaward;
          const filter = { username:  username };
          const update = {
              $inc: { Wallet: waletdeuction }, // Deduct from Wallet
             
              $push: { 
                  gameHistory: { 
                      gameId: depo1,
                      stake: stake,
                      numberofplayer:numberofplayer,
                      profit:profit,
                      awardforagen:awardforagent, 
                      PayeForVendor: PayeForVendor, 
                      winerAward: winerAward,
                      totalcash: totalcash,
                      percent:percent,
                      timestamp: new Date()
                  } 
              } // Push new game history entry
          };

          const result = await BingoBord.updateOne(filter, update);
          if (result.matchedCount === 0) {
              console.log("No documents matched the filter.");
          } else if (result.modifiedCount === 0) {
              console.log("Document was found, but no updates were made.");
          } else {
              console.log("Document updated successfully.");
          }
          return res.json("updated"); // Send response after successful update
      } else {
          // If player does not exist, insert data and respond
          await BingoBord.insertMany([data]); // Ensure collection is defined correctly here
          return res.json("notexist");
      }
  } catch (e) {
      console.error("Database error:", e); // Log the error
      if (!res.headersSent) { // Ensure response is sent only once
          res.json("fail");
      }
  }
});

app.post("/login", async (req, res) => {
  const { username, password, } = req.body;

  try {
    const user = await BingoBord.login(username, password); // your login logic
    const token = createToken(user._id);

    return res.status(200).json({ username, token }); // send one response and return
  } catch (error) {
    return res.status(400).json({ error: error.message }); // only sent if error occurs
  }
});



app.post("/gameid",async(req,res)=>{
 
  const lastGame = await GameIdCounter.findOne().sort({ gameId: -1 }); // Sort by gameId in descending order

  if (lastGame) {
      return lastGame.gameId; // Return the gameId of the last game
  } else {
      throw new Error("No games found.");
  }

})
const port=process.env.PORT;
server.listen(port||3001,'0.0.0.0',()=>{
    console.log(`port connected port  ${port}`);
})
