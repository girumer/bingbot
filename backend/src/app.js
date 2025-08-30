 require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

const express = require("express")
const async = require('async');
const cartela = require('./cartela.json');
const BingoBord=require("../Models/BingoBord")

const Transaction = require("../Models/Transaction");
const jwt=require('jsonwebtoken')
const cors = require("cors")
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


const rooms = {}; // rooms = { roomId: { players, socketClient, selectedIndexes, playerCartelas, timer, calledNumbers, numberInterval, alreadyWon, totalAward } }

io.on("connection", (socket) => {
  console.log("New connection:", socket.id);

  // --- JOIN ROOM ---
  socket.on("joinRoom", ({ roomId, username, clientId }) => {
    const rId = String(roomId);
    socket.join(rId);

    if (!rooms[rId]) {
      rooms[rId] = {
        players: {},
        socketClient: {},
        selectedIndexes: [],
        playerCartelas: {},
        timer: null,
        calledNumbers: [],
        numberInterval: null,
        alreadyWon: [],
        totalAward: 0,
      };
      console.log(`Room created: ${rId}`);
    }

    rooms[rId].players[socket.id] = username;
    rooms[rId].socketClient[socket.id] = clientId;

    if (!rooms[rId].playerCartelas[clientId]) rooms[rId].playerCartelas[clientId] = [];
    const myCartelas = rooms[rId].playerCartelas[clientId];

    // 👉 include totalPlayers here too
    socket.emit("currentGameState", {
      calledNumbers: rooms[rId].calledNumbers,
      myCartelas,
      selectedIndexes: rooms[rId].selectedIndexes,
      lastNumber: rooms[rId].calledNumbers.slice(-1)[0] || null,
      timer: rooms[rId].timer,
      totalAward: rooms[rId].totalAward,
      totalPlayers: Object.keys(rooms[rId].players).length,
       activeGame: rooms[rId].activeGame || false
    });

    // 👉 broadcast live player count on join
    const activePlayers = Object.values(rooms[rId].playerCartelas).filter(arr => arr.length > 0).length;
  io.to(rId).emit("playerCount", { totalPlayers: activePlayers });
  });

  // --- SELECT CARTELA ---
// --- SELECT CARTELA ---
// --- SELECT CARTELA ---
// --- SELECT CARTELA ---
socket.on("selectCartela", async ({ roomId, cartelaIndex }) => {
  const rId = String(roomId);
  const socketId = socket.id;

  // ✅ Get clientId from this socket
  const clientId = rooms[rId]?.socketClient?.[socketId];
  if (!clientId) {
    socket.emit("cartelaRejected", { message: "Client ID not found" });
    return;
  }

  if (!rooms[rId] || rooms[rId].selectedIndexes.includes(cartelaIndex)) {
    socket.emit("cartelaRejected", { message: "Cartela already taken or room not found" });
    return;
  }

  try {
    const username = rooms[rId].players[socketId];
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

    // ✅ Use clientId here
    if (!rooms[rId].playerCartelas[clientId]) rooms[rId].playerCartelas[clientId] = [];
    const userCartelas = rooms[rId].playerCartelas[clientId];

    // Limit per user to 4 cartelas
    if (userCartelas.length >= 4) {
      socket.emit("cartelaRejected", { message: "You can only select up to 4 cartelas" });
      return;
    }

    // Deduct stake
    user.Wallet -= stake;
    await user.save();

    // Update room data
    userCartelas.push(cartelaIndex);
    rooms[rId].selectedIndexes.push(cartelaIndex);

    socket.emit("cartelaAccepted", { cartelaIndex, Wallet: user.Wallet });
    io.to(rId).emit("updateSelectedCartelas", { selectedIndexes: rooms[rId].selectedIndexes });

    // Start countdown if 2+ players have at least 1 cartela
    const playersWithCartela = Object.values(rooms[rId].playerCartelas).filter(arr => arr.length > 0).length;
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
    io.to(roomId).emit("currentCalledNumbers", room.calledNumbers.slice(-5).reverse());
    io.to(roomId).emit("updateSelectedCartelas", { selectedIndexes: room.selectedIndexes });

    checkWinners(roomId, number);
  });

  // --- DISCONNECT ---
  socket.on("disconnect", () => {
    for (const roomId in rooms) {
      const clientId = rooms[roomId]?.socketClient?.[socket.id];
      if (rooms[roomId]?.players?.[socket.id]) {
        delete rooms[roomId].players[socket.id];
        delete rooms[roomId].socketClient[socket.id];

        io.to(roomId).emit("updateSelectedCartelas", { selectedIndexes: rooms[roomId].selectedIndexes });
        // 👉 broadcast live player count on leave
        io.to(roomId).emit("playerCount", { totalPlayers: Object.keys(rooms[roomId].players).length });
      }
    }
  });
});

// ================= GAME FUNCTIONS =================
function startNumberGenerator(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  const playersWithCartela = Object.values(room.playerCartelas).filter(arr => arr.length > 0).length;
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
    if (!room.calledNumbers.includes(nextNumber)) room.calledNumbers.push(nextNumber);

    io.to(roomId).emit("numberCalled", nextNumber);
    io.to(roomId).emit("currentCalledNumbers", room.calledNumbers.slice(-5).reverse());

    checkWinners(roomId, nextNumber);
  }, 4000);
}

function startCountdown(roomId, seconds) {
  if (!rooms[roomId]) return;

  let timeLeft = seconds;

  // Prevent multiple timers
  if (rooms[roomId].timer) return;

  rooms[roomId].timer = timeLeft;

  // Emit countdown every second
  rooms[roomId].numberInterval = setInterval(async () => {
    timeLeft -= 1;
    rooms[roomId].timer = timeLeft;

    // Emit to all clients in the room for live timer display
    io.to(roomId).emit("startCountdown", timeLeft);

    // When countdown ends
    if (timeLeft <= 0) {
      clearInterval(rooms[roomId].numberInterval);
      rooms[roomId].timer = null;

      const room = rooms[roomId];

      // 1️⃣ Send selected cartelas only to users who picked one
      for (const socketId in room.socketClient) {
        const clientId = room.socketClient[socketId];
        const myCartelas = room.playerCartelas[clientId] || [];
        if (myCartelas.length > 0) {
          io.to(socketId).emit("myCartelas", myCartelas);
        }
      }

      // 2️⃣ Set room active status and emit to everyone
      room.activeGame = true;
      io.to(roomId).emit("activeGameStatus", { activeGame: true });

      // 3️⃣ Calculate total award and emit to everyone
      const totalCartelas = Object.values(room.playerCartelas).reduce((sum, arr) => sum + arr.length, 0);
      room.totalAward = totalCartelas * Number(roomId) * 0.8;
      io.to(roomId).emit("gameStarted", {
        totalAward: room.totalAward,
        totalPlayers: Object.keys(room.players).length
      });

      // 4️⃣ Start number generator for everyone
      startNumberGenerator(roomId);
    }
  }, 1000);
}


// --- WIN LOGIC ---
function findWinningPattern(cartelaData, calledNumbers) {
  if (!cartelaData) return null;
  for (let i = 0; i < 5; i++) {
    if (cartelaData[i].every(num => calledNumbers.includes(num) || num === "*")) return cartelaData[i];
    const col = cartelaData.map(row => row[i]);
    if (col.every(num => calledNumbers.includes(num) || num === "*")) return col;
  }
  const diag1 = [0,1,2,3,4].map(i => cartelaData[i][i]);
  const diag2 = [0,1,2,3,4].map(i => cartelaData[i][4-i]);
  if (diag1.every(num => calledNumbers.includes(num) || num === "*")) return diag1;
  if (diag2.every(num => calledNumbers.includes(num) || num === "*")) return diag2;
  const corners = [cartelaData[0][0], cartelaData[0][4], cartelaData[4][0], cartelaData[4][4]];
  if (corners.every(num => calledNumbers.includes(num) || num === "*")) return corners;
  const innerCorners = [cartelaData[1][1], cartelaData[1][3], cartelaData[3][1], cartelaData[3][3]];
  if (innerCorners.every(num => calledNumbers.includes(num) || num === "*")) return innerCorners;
  return null;
}

async function saveGameHistory(username, roomId, stake, outcome) {
  try {
    const user = await BingoBord.findOne({ username });
    if (!user) return;
    user.gameHistory.push({ roomId: Number(roomId), stake: Number(stake), outcome, timestamp: new Date() });
    await user.save();
  } catch (err) {
    console.error("Failed to save game history:", err);
  }
}

async function checkWinners(roomId, calledNumber) {
  const room = rooms[roomId];
  if (!room) return;

  const winners = [];

  // Only consider clients who selected at least 1 cartela
  for (const clientId in room.playerCartelas) {
    const cartelas = room.playerCartelas[clientId];
    if (!cartelas || cartelas.length === 0) continue;

    // Find username for this client
    const username = Object.entries(room.players).find(
      ([sid, _]) => room.socketClient[sid] === clientId
    )?.[1];
    if (!username) continue;

    for (const cartelaIndex of cartelas) {
      if (!cartela[cartelaIndex]) continue;

      const key = clientId + "-" + cartelaIndex;

      // Skip if already won
      if (room.alreadyWon.includes(key)) continue;

      const pattern = findWinningPattern(cartela[cartelaIndex].cart, room.calledNumbers);

      if (pattern) {
        winners.push({ clientId, cartelaIndex, pattern, winnerName: username });
        room.alreadyWon.push(key);
      }
    }
  }

  if (winners.length > 0) {
    // Stop number generator
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
        await saveGameHistory(winner.winnerName, roomId, awardPerWinner, "win");
      }
    }

    // Save loss for players who selected cartelas but didn't win
    for (const clientId in room.playerCartelas) {
      const cartelas = room.playerCartelas[clientId];
      if (!cartelas || cartelas.length === 0) continue;

      const username = Object.entries(room.players).find(
        ([sid, _]) => room.socketClient[sid] === clientId
      )?.[1];
      if (!username) continue;

      if (!winners.some(w => w.winnerName === username)) {
        await saveGameHistory(username, roomId, Number(roomId), "loss");
      }
    }

    // Emit winners to frontend
    io.to(roomId).emit("winningPattern", winners);

    // Reset room after 4 seconds
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
app.use('/admin-api', adminRoutes);

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
app.post("/api/parse-transaction", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "Message is required" });

    let type, amount, transactionNumber;

    // --- Detect Telebirr ---
    if (message.includes("telebirr")) {
      type = "telebirr";
      const amountMatch = message.match(/ETB\s*([\d,]+\.\d{2})/);
      const transMatch = message.match(/transaction number is (\w+)/i);

      if (amountMatch) amount = parseFloat(amountMatch[1].replace(/,/g, ""));
      if (transMatch) transactionNumber = transMatch[1];
    }

    // --- Detect CBE ---
    if (message.includes("CBE") || message.includes("Commercial Bank")) {
      type = "cbe";
      const amountMatch = message.match(/ETB\s*([\d,]+\.\d{2})/);
      const transMatch = message.match(/Txn[:\s]+(\w+)/i);

      if (amountMatch) amount = parseFloat(amountMatch[1].replace(/,/g, ""));
      if (transMatch) transactionNumber = transMatch[1];
    }

    if (!type || !amount || !transactionNumber) {
      return res.status(400).json({ error: "Failed to parse transaction message" });
    }

    // Save to DB
    const newTx = new Transaction({
      transactionNumber,
      type,
      amount,
      rawMessage: message,
    });

    await newTx.save();

    res.json({
      success: true,
      transaction: {
        transactionNumber,
        type,
        amount,
      }
    });

  } catch (err) {
    console.error("Error saving transaction:", err);
    res.status(500).json({ error: "Server error" });
  }
});
app.get("/admin-api/transactions-list", async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .sort({ createdAt: -1 })
      .limit(50); // latest 50
    res.json(transactions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch transactions" });
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
app.post("/depositcheckB",async(req,res)=>{
  const{username}=req.body
  console.log(username);
  const data1 = await BingoBord.findOne({ username: username });
  
    let depo1=parseInt(`${data1.Wallet}`);
   // console.log("user name is ",data1);

  try{
 
      if(data1){
          res.json(depo1)
          console.log("your balance is ",depo1);
      }
      else{
          res.json("notexist")
      }

  }
  catch(e){
    console.log(e);
      res.json("fail")
  }

})    
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
