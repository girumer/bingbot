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
const leaderboardRoutes = require("../routes/leaderboardRoutes");

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




// =========================================================================
// !!! CRITICAL: Add the necessary modules/dependencies here if not globally available !!!
// Assuming BingoBord model and cartela data ('cart') are available globally/imported.

// Define the players you want to inject
// Define the players you want to inject
const forcedPlayersData = [
    { username: 'joni', clientId: '200001x' },
    { username: 'abebayhu', clientId: '200002x' },
    { username: 'fraole', clientId: '200003x' },
    { username: 'sisaye', clientId: '200004x' },
    
    // --- NEW PLAYERS ---
    { username: 'jemale2', clientId: '200014x' },
    { username: 'takur', clientId: '200015x' },
    { username: 'gadese', clientId: '200016x' },
    { username: 'yosephh', clientId: '2000787x' },
    { username: 'yesake', clientId: '200019x' },
    { username: 'zeelaleme', clientId: '200020x' },
    { username: 'keedir', clientId: '200021x' },
    { username: 'yedneke', clientId: '200017x' },
    { username: 'semir', clientId: '200018x' },
    { username: 'aseamawe', clientId: 'client-tariku-bot' },
    { username: 'derabulbula', clientId: 'client-cita-bot' },
    { username: 'natiman', clientId: 'client-chkuni-bot' },
];
// Note: clientId must be unique strings for the game logic to work correctly.
const NUM_CARTELAS_PER_PLAYER = 1;

/**
 * Inserts predefined players into a room, assigns random cartelas,
 * deducts their stake, and updates the room state to force the countdown.
 * @param {string} rId - The room ID (also the stake amount).
 * @param {string} initiatorClientId - The clientId of the player who triggered this action.
 */
/* async function injectAndSelectForForcedPlayers(rId, initiatorClientId) {
    const room = rooms[rId];
    const stake = Number(rId);

    // Only inject if the game is not already running or in countdown
    if (room.activeGame || room.timer !== null) return;
    
    console.log(`[INJECT] Starting injection for Room ${rId}...`);

    for (const player of forcedPlayersData) {
        // Skip the injection if the player is the one who initiated the action
        if (player.clientId === initiatorClientId) continue; 
        
        // 1. Check if player is already in the room or has cartelas (to prevent double-processing)
        if (room.players[player.clientId] && room.playerCartelas[player.clientId].length > 0) {
            continue;
        }

        try {
            const user = await BingoBord.findOne({ username: player.username });

            if (!user) {
                console.error(`[INJECT ERROR] User ${player.username} not found in DB.`);
                continue;
            }
            if (user.Wallet < stake * NUM_CARTELAS_PER_PLAYER) {
                 console.error(`[INJECT ERROR] User ${player.username} has insufficient wallet.`);
                continue;
            }
            
            // 2. Add player to room (simulating 'joinRoom')
            room.players[player.clientId] = player.username;
            room.playerCartelas[player.clientId] = [];

            // 3. Select 4 random cartelas and update DB
            for (let i = 0; i < NUM_CARTELAS_PER_PLAYER; i++) {
                let cartelaIndex;
                // Generate a random, unique cartela index (1 to 75)
                do {
                    cartelaIndex = Math.floor(Math.random() * 75) + 1;
                } while (room.selectedIndexes.includes(cartelaIndex));

                // Deduct funds and save
                user.Wallet -= stake;
                
                // Update Room State
                room.playerCartelas[player.clientId].push(cartelaIndex);
                room.selectedIndexes.push(cartelaIndex);
            }
            await user.save();
            console.log(`[INJECT SUCCESS] ${player.username} assigned 4 cartelas and wallet deducted.`);

        } catch (error) {
            console.error(`[INJECT FAILED] Error processing ${player.username}:`, error);
        }
    }
    
    // 4. Update all connected clients about the new total cartelas
    const totalCartelas = room.selectedIndexes.length;
    io.to(rId).emit("updateSelectedCartelas", {
        selectedIndexes: room.selectedIndexes,
        totalPlayers: room.selectedIndexes.length
    });
    
    // 5. Check if the game can now start
    const playersWithCartela = Object.values(room.playerCartelas).filter(
      (arr) => arr.length > 0
    ).length;
    
    if (!room.timer && playersWithCartela >= 2) {
      console.log(`[INJECT TRIGGER] ${playersWithCartela} total players now. Starting 45s countdown.`);
      startCountdown(rId, 60);
    }
} */
async function processNextBotCartelaSequential(rId, player) {
    const room = rooms[rId];
    const stake = Number(rId);
    const clientId = player.clientId;

    // 1. Check if bot is already fully injected
    const currentCartelas = room.playerCartelas[clientId]?.length || 0;
    if (currentCartelas >= NUM_CARTELAS_PER_PLAYER) {
        return 'COMPLETE';
    }

    try {
        const user = await BingoBord.findOne({ username: player.username });

        if (!user) {
            console.error(`[INJECT ERROR] User ${player.username} not found in DB.`);
            return 'ERROR';
        }

        // 2. Initial Setup (if first cartela) & Funds Check
        if (!(room.players[clientId])) {
            // Add bot to room state if they are not already there
            room.players[clientId] = player.username;
            room.playerCartelas[clientId] = room.playerCartelas[clientId] || [];
        }

        if (user.Wallet < stake) {
            console.error(`[INJECT ERROR] User ${player.username} has insufficient wallet (${user.Wallet}) for 1 ticket.`);
            // Mark bot as skipped if funds are insufficient for the current ticket
            return 'SKIPPED'; 
        }

        // 3. Select one unique cartela
        let cartelaIndex;
        // Generate a random, unique cartela index (1 to 75)
        do {
            cartelaIndex = Math.floor(Math.random() * 75) + 1;
        } while (room.selectedIndexes.includes(cartelaIndex));

        // Deduct funds and save
        user.Wallet -= stake;
        await user.save();

        // Update Room State
        room.playerCartelas[clientId].push(cartelaIndex);
        room.selectedIndexes.push(cartelaIndex);
        
        console.log(`[INJECT SUCCESS] ${player.username} selected cartela #${cartelaIndex} (Total: ${room.playerCartelas[clientId].length}/${NUM_CARTELAS_PER_PLAYER}).`);

        // 4. Broadcast Update (Total cartelas/tickets)
        const totalCartelas = room.selectedIndexes.length;
        io.to(rId).emit("updateSelectedCartelas", {
            selectedIndexes: room.selectedIndexes,
        });
        io.to(rId).emit("playerCount", { totalPlayers: totalCartelas });
        
        return 'SUCCESS';

    } catch (error) {
        console.error(`[INJECT FAILED] Error processing ${player.username}:`, error);
        return 'ERROR';
    }
}
/* function startInjectionMonitor(rId, initiatorClientId) {
    const room = rooms[rId];
    if (!room) return;

    // Check if the game is already running (activeGame is true).
    // We MUST allow the monitor to run if room.timer !== null (countdown is active)
    // because the auto players must select cartela even if the game is starting.
    if (room.activeGame) return; 
    
    // Clear any existing monitor to prevent duplicates
    if (room.injectInterval) clearInterval(room.injectInterval);

    console.log(`[INJECT MONITOR] Starting 1s sequential cartela injection for room ${rId}.`);
    
    // Bots must exclude the initiating player, in case the initiator is one of the bot IDs.
    const activeBots = forcedPlayersData.filter(player => player.clientId !== initiatorClientId);
    let currentBotIndex = 0; // Tracks which bot in the cycle is next (0, 1, 2, 3, 0, 1, 2, 3...)

    room.injectInterval = setInterval(async () => {
        // --- 1. Cleanup Check ---
        // Stop if room closed or game is active. Keep running if timer is active.
        if (!rooms[rId] || rooms[rId].activeGame) {
            clearInterval(room.injectInterval);
            rooms[rId].injectInterval = null;
            console.log(`[INJECT MONITOR] Cleared monitor for room ${rId} (Game started or room closed).`);
            return;
        }
        
        // --- 2. Check Completion & Trigger Countdown Check (UPDATED LOGIC) ---
        const totalCartelas = room.selectedIndexes.length;
        // The total number of cartelas for the bots + the user's initial cartela (1)
        const maxTotalCartelas = (activeBots.length * NUM_CARTELAS_PER_PLAYER) + 1; 

        // NEW LOGIC: Start countdown immediately if >= 2 players have tickets and timer hasn't started
        const playersWithCartela = Object.values(room.playerCartelas).filter(
            (arr) => arr.length > 0
        ).length;
        
        if (!room.timer && playersWithCartela >= 2) {
            console.log(`[INJECT TRIGGER] ${playersWithCartela} players now have cartelas. Starting 45s countdown.`);
            startCountdown(rId, 45);
            // DO NOT return, continue to inject the next bot ticket
        }

        // Stop monitor only when max cartelas reached
        if (totalCartelas >= maxTotalCartelas) {
            clearInterval(room.injectInterval);
            rooms[rId].injectInterval = null;
            console.log(`[INJECT MONITOR] Cleared monitor for room ${rId} (All cartelas selected).`);
            return;
        }

        // --- 3. Sequential Injection Logic ---
        // Cycle through the bots (0, 1, 2, 3)
        const botToInject = activeBots[currentBotIndex];
        
        if (botToInject) {
            const botCartelaCount = room.playerCartelas[botToInject.clientId]?.length || 0;

            // Only attempt injection if the bot hasn't reached its limit
            if (botCartelaCount < NUM_CARTELAS_PER_PLAYER) {
                const result = await processNextBotCartelaSequential(rId, botToInject);
                
                // If the ticket was successfully purchased or failed/skipped, move to the next bot
                if (result === 'SUCCESS' || result === 'SKIPPED' || result === 'ERROR') {
                    currentBotIndex = (currentBotIndex + 1) % activeBots.length;
                }
                // Note: If result is 'COMPLETE', we still move to the next bot.
            } else {
                 // This bot is full (4 cartelas), skip them and check the next one immediately in the next cycle.
                 currentBotIndex = (currentBotIndex + 1) % activeBots.length;
            }
        }
        
    }, 2000);
} */
/* function startInjectionMonitor(rId, initiatorClientId) {
    const room = rooms[rId];
    if (!room) return;

    // Check if the game is already running (activeGame is true).
    if (room.activeGame) return; 
    
    // Clear any existing monitor to prevent duplicates
    if (room.injectInterval) clearInterval(room.injectInterval);

    console.log(`[INJECT MONITOR] Starting 2s sequential cartela injection for room ${rId}.`); // Adjusted timing to 2s for better sequential feel
    
    // Bots must exclude the initiating player, in case the initiator is one of the bot IDs.
    const activeBots = forcedPlayersData.filter(player => player.clientId !== initiatorClientId);
    let currentBotIndex = 0; // Tracks which bot in the cycle is next

    room.injectInterval = setInterval(async () => {
        // --- 1. Cleanup Check ---
        if (!rooms[rId] || rooms[rId].activeGame) {
            clearInterval(room.injectInterval);
            rooms[rId].injectInterval = null;
            console.log(`[INJECT MONITOR] Cleared monitor for room ${rId} (Game started or room closed).`);
            return;
        }
        
        // --- 2. Completion Check (BOTS ONLY) ---
        const maxBotCartelas = activeBots.length * NUM_CARTELAS_PER_PLAYER; 
        
        // Count how many cartelas the active bots have successfully purchased
        const currentBotCartelas = activeBots.reduce((sum, bot) => {
            return sum + (room.playerCartelas[bot.clientId]?.length || 0);
        }, 0);

        // Stop monitor when ALL intended bot cartelas (1 per bot) are selected
        if (currentBotCartelas >= maxBotCartelas) { 
            clearInterval(room.injectInterval);
            rooms[rId].injectInterval = null;
            console.log(`[INJECT MONITOR] Cleared monitor for room ${rId} (All ${maxBotCartelas} bot cartelas selected).`);
            return;
        }

        // --- 3. Start Countdown Check ---
        const playersWithCartela = Object.values(room.playerCartelas).filter(
            (arr) => arr.length > 0
        ).length;
        
        // Start countdown immediately if >= 2 players have tickets and timer hasn't started
        if (!room.timer && playersWithCartela >= 2) {
            console.log(`[INJECT TRIGGER] ${playersWithCartela} players now have cartelas. Starting 45s countdown.`);
            startCountdown(rId, 45);
            // DO NOT return, continue to inject the next bot ticket during countdown
        }

        // --- 4. Sequential Injection Logic ---
        const botToInject = activeBots[currentBotIndex];
        
        if (botToInject) {
            const botCartelaCount = room.playerCartelas[botToInject.clientId]?.length || 0;

            // Only attempt injection if the bot hasn't reached its limit (1)
            if (botCartelaCount < NUM_CARTELAS_PER_PLAYER) {
                const result = await processNextBotCartelaSequential(rId, botToInject);
                
                // Always cycle to the next bot if processing was attempted
                if (result === 'SUCCESS' || result === 'SKIPPED' || result === 'ERROR') {
                    currentBotIndex = (currentBotIndex + 1) % activeBots.length;
                }
            } else {
                // This bot is full, skip them and check the next one immediately in the next cycle.
                currentBotIndex = (currentBotIndex + 1) % activeBots.length;
            }
        }
        
    }, 2000); // Check every 2 seconds
} */
function startInjectionMonitor(rId, initiatorClientId) {
    const room = rooms[rId];
    if (!room) return;

    if (room.activeGame) return; 
    
    // Clear the existing interval/timeout before starting a new one
    if (room.injectInterval) clearTimeout(room.injectInterval);

    console.log(`[INJECT MONITOR] Starting 2s sequential cartela injection for room ${rId}.`);
    
    const activeBots = forcedPlayersData.filter(player => player.clientId !== initiatorClientId);
    let currentBotIndex = 0;
    const DELAY_MS = 2000; // 2 seconds

    // Use a self-invoking, named async function for sequential processing
    const runInjectionCycle = async () => {
        // --- 1. Cleanup Check ---
        if (!rooms[rId] || rooms[rId].activeGame) {
            console.log(`[INJECT MONITOR] Cleared monitor for room ${rId} (Game started or room closed).`);
            room.injectInterval = null; // Mark as cleared
            return;
        }
        
        // --- 2. Completion Check (BOTS ONLY) ---
        const maxBotCartelas = activeBots.length * NUM_CARTELAS_PER_PLAYER; 
        const currentBotCartelas = activeBots.reduce((sum, bot) => {
            return sum + (room.playerCartelas[bot.clientId]?.length || 0);
        }, 0);

        if (currentBotCartelas >= maxBotCartelas) { 
            console.log(`[INJECT MONITOR] Cleared monitor for room ${rId} (All ${maxBotCartelas} bot cartelas selected).`);
            room.injectInterval = null;
            return;
        }

        // --- 3. Start Countdown Check (No change here) ---
        // ... (Your existing countdown check logic) ...

        const playersWithCartela = Object.values(room.playerCartelas).filter(
            (arr) => arr.length > 0
        ).length;
        
        if (!room.timer && playersWithCartela >= 2) {
            console.log(`[INJECT TRIGGER] ${playersWithCartela} players now have cartelas. Starting 45s countdown.`);
            startCountdown(rId, 45);
        }


        // --- 4. Sequential Injection Logic ---
        const botToInject = activeBots[currentBotIndex];
        
        if (botToInject) {
            const botCartelaCount = room.playerCartelas[botToInject.clientId]?.length || 0;

            if (botCartelaCount < NUM_CARTELAS_PER_PLAYER) {
                // 🚀 AWAIT HERE! Execution pauses until this is complete.
                await processNextBotCartelaSequential(rId, botToInject); 
                
                // Always cycle to the next bot after processing attempt
                currentBotIndex = (currentBotIndex + 1) % activeBots.length;
            } else {
                // This bot is full, skip them and check the next one immediately
                currentBotIndex = (currentBotIndex + 1) % activeBots.length;
            }
        } else {
            // Should not happen if activeBots is populated, but cycle safely
            currentBotIndex = (currentBotIndex + 1) % activeBots.length;
        }

        // 5. Schedule the next run *after* the current task is complete
        room.injectInterval = setTimeout(runInjectionCycle, DELAY_MS);
    };

    // Start the cycle
    room.injectInterval = setTimeout(runInjectionCycle, DELAY_MS);
    // You should use clearTimeout(room.injectInterval) instead of clearInterval when stopping it.
}
    function startRoomMonitor() {
    // Run this check every 5 seconds
    setInterval(() => {
        // Iterate through all currently existing rooms
        for (const rId in rooms) {
            const room = rooms[rId];
            if (!room) continue;

            // 1. Check if the game is already in progress or starting
            if (room.activeGame || room.timer !== null) {
                // Game is running or counting down, no action needed
                continue;
            }

            // 2. Check for human players with cartelas
            // Filter out clients that are in the forcedPlayersData list (i.e., bots)
            const humanPlayersWithCartela = Object.keys(room.playerCartelas).filter(clientId => {
                const isBot = forcedPlayersData.some(bot => bot.clientId === clientId);
                const hasCartela = room.playerCartelas[clientId] && room.playerCartelas[clientId].length > 0;
                return !isBot && hasCartela;
            }).length;

            // 3. If NO human players have selected a cartela, and the room is idle,
            if (humanPlayersWithCartela === 0) {
                // Check if the bot injection monitor is already running.
                if (room.injectInterval) {
                    // Bot injection is already in progress, just let it run.
                    continue;
                }
                
                // Select a random bot to be the "initiator"
                const initiatorBot = forcedPlayersData[Math.floor(Math.random() * forcedPlayersData.length)];
                
                console.log(`[AUTO-START] Room ${rId} is idle. Forcing start via bot ${initiatorBot.username}.`);
                
                // Call the original injection function to force the room state to start the process.
                // This will kick off the countdown when the first bot buys its ticket.
                startInjectionMonitor(rId, initiatorBot.clientId);
            }
        }
    }, 5000); // Check every 5 seconds (adjust as needed)
}

// =========================================================================
const rooms = {}; // rooms = { roomId: { players, selectedIndexes, playerCartelas, ... } }
const socketIdToClientId = new Map();
const clientIdToSocketId = new Map();
 startRoomMonitor();
io.on("connection", (socket) => {
  //console.log("New connection:", socket.id);
// Add this block inside your main io.on("connection", (socket) => { ... });

// --- SPINNER GAME HANDLER ---

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
       timerInterval: null,    // for countdown
       numberInterval: null,
       injectInterval: null,
        alreadyWon: [],
        totalAward: 0,
        gameId: null,
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
      totalPlayers: Object.values(rooms[rId].playerCartelas).reduce(
    (sum, arr) => sum + arr.length,
    0
  ),
      activeGame: rooms[rId].activeGame || false,
       gameId: rooms[rId].gameId || null
    });

    // ✅ Broadcast updated player count
   /*  const activePlayers = Object.values(rooms[rId].playerCartelas).filter(
      (arr) => arr.length > 0
    ).length;
    io.to(rId).emit("playerCount", { totalPlayers: activePlayers });
 */
const activePlayers = Object.values(rooms[rId].playerCartelas)
  .reduce((sum, arr) => sum + arr.length, 0);

io.to(rId).emit("playerCount", { totalPlayers: activePlayers });

   // console.log(`New connection: ${socket.id}, username=${username}, telegramId=${telegramId}, clientId=${clientId}`);
  });
// --- CHECK PLAYER STATUS ---
socket.on("checkPlayerStatus", ({ roomId, clientId }) => {
    const room = rooms[String(roomId)];

    // 1. Check if the room exists.
    // 2. Check if there's an active game in the room.
    // 3. Check if this specific player has selected cartelas.
    if (!room || !room.activeGame || !room.playerCartelas[clientId] || room.playerCartelas[clientId].length === 0) {
        // Player is not in an active game or has no cartelas, so they should go to the selection page.
        socket.emit("playerStatus", { inGame: false });
        console.log(`Player ${clientId} is not in an active game in room ${roomId}.`);
        return;
    }

    // Player is already in an active game with selected cartelas.
    const selectedCartelas = room.playerCartelas[clientId];
    socket.emit("playerStatus", { inGame: true, selectedCartelas });
   // console.log(`Player ${clientId} is already in game in room ${roomId}.`);
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
        if (rooms[rId].activeGame || (rooms[rId].timer !== null && rooms[rId].timer <= 4)) {
        socket.emit("cartelaRejected", {
            message: "The game is about to start or is already active. Cartela selection is closed."
        });
        return;
    }
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
     // console.log("caretela accepted now");
      io.to(rId).emit("updateSelectedCartelas", {
        selectedIndexes: rooms[rId].selectedIndexes,
      });
if (userCartelas.length === 1) { 
        // This will inject the 4 players and then automatically check and start the countdown
        // inside the injector function itself.
       startInjectionMonitor(rId, clientId);
     }
  /*     const playersWithCartela = Object.values(rooms[rId].playerCartelas).filter(
        (arr) => arr.length > 0
      ).length;
      if (!rooms[rId].timer && playersWithCartela >= 2) {
         //injectAndSelectForForcedPlayers(rId, clientId);
        startCountdown(rId, 45);
      } */
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
// --- DISCONNECT ---
// --- DISCONNECT ---
// --- DISCONNECT ---
socket.on("disconnect", () => {
  const clientId = socketIdToClientId.get(socket.id);
  if (!clientId) return;

  // Clean up maps
  socketIdToClientId.delete(socket.id);
  clientIdToSocketId.delete(clientId);

  for (const roomId in rooms) {
    const room = rooms[roomId];
    if (!room || !room.players[clientId]) continue;

    // Remove player from room
    delete room.playerCartelas[clientId];
    delete room.players[clientId];

    // Check if room is now empty
    const playersWithCartela = Object.values(room.playerCartelas).filter(
      arr => arr.length > 0
    ).length;

    if (playersWithCartela === 0) {
      // Room has no players with cartelas - check if completely empty
      const totalPlayers = Object.keys(room.players).length;
      if (totalPlayers === 0) {
        // Room is completely empty - delete it
        console.log(`Room ${roomId} is empty after disconnect. Deleting room.`);
        resetRoom(roomId);
        delete rooms[roomId];
      } else {
        // Room has spectators but no players with cartelas - just reset
        resetRoom(roomId);
      }
    }
    break;
  }
});
});

function resetRoom(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  // Clear all intervals
  if (room.timerInterval) {
    clearInterval(room.timerInterval);
    room.timerInterval = null;
  }
  if (room.numberInterval) {
    clearInterval(room.numberInterval);
    room.numberInterval = null;
  }
if (room.injectInterval) {
        clearTimeout(room.injectInterval);
        room.injectInterval = null;
    }
  // Reset room state but keep players
  room.activeGame = false;
  room.selectedIndexes = [];
  room.calledNumbers = [];
  room.alreadyWon = [];
  room.totalAward = 0;
  room.gameId = null;
  room.timer = null;

  // Reset player cartelas but keep players
  for (const clientId in room.playerCartelas) {
    room.playerCartelas[clientId] = [];
  }

  io.to(roomId).emit("roomAvailable");
  io.to(roomId).emit("resetRoom");
}
/**
 * Monitors all rooms to prevent them from becoming completely idle.
 * If a room is idle (no timer, no active game, no real players with cartelas),
 * it injects the first bot to start the process.
 */

// ================= GAME FUNCTIONS =================
function startNumberGenerator(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  
  const playersWithCartela = Object.values(room.playerCartelas).filter(
    (arr) => arr.length > 0
  ).length;
  
  if (playersWithCartela < 1) return;
  if (!Array.isArray(room.calledNumbers)) room.calledNumbers = [];
  
  // Create an array with all 75 numbers
  const numbers = Array.from({ length: 75 }, (_, i) => i + 1);
  console.log(`[Room ${roomId}] Shuffled numbers:`, numbers);
  
  // Fisher-Yates shuffle algorithm to randomize the array
  for (let i = numbers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
  }
  
  // Use the shuffled array directly with error handling
  room.numberInterval = setInterval(() => {
    try {
      if (!rooms[roomId]) {
        clearInterval(room.numberInterval);
        return;
      }

      // If all numbers have been called, end the game
      if (room.calledNumbers.length >= 75) {
        clearInterval(room.numberInterval);
        room.numberInterval = null;

        // After all numbers, check for winners one last time
        checkWinners(roomId, room.calledNumbers.slice(-1)[0]);

        // If no winner was found by checkWinners, reset the room manually
        if (room.alreadyWon.length === 0) {
          console.log(`No winner in room ${roomId} after all numbers. Resetting room.`);
          resetRoom(roomId);
        }
        return;
      }
      
      // Get the next number from the shuffled array
      const nextNumber = numbers[room.calledNumbers.length];
      
      // Add to called numbers
      room.calledNumbers.push(nextNumber);
      
      // Emit to all clients
      io.to(roomId).emit("numberCalled", nextNumber);
      io.to(roomId).emit("currentCalledNumbers", room.calledNumbers.slice(-5).reverse());
      
      // Check for winners
      checkWinners(roomId, nextNumber);
      
    } catch (error) {
      console.error(`Error in number generator for room ${roomId}:`, error);
      clearInterval(room.numberInterval);
      room.numberInterval = null;
    }
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
  rooms[roomId].timerInterval = setInterval(async () => {
    timeLeft -= 1;
    rooms[roomId].timer = timeLeft;
    io.to(roomId).emit("startCountdown", timeLeft);
    if (timeLeft <= 0) {
      clearInterval(rooms[roomId].timerInterval);
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
      io.to(roomId).emit("activeGameStatus", { activeGame: true ,gameId: room.gameId  });

      const totalCartelas = Object.values(room.playerCartelas).reduce(
        (sum, arr) => sum + arr.length,
        0
      );
      room.totalAward = totalCartelas * Number(roomId) * 0.8;
      io.to(roomId).emit("gameStarted", {
        totalAward: room.totalAward,
        //totalPlayers: Object.keys(room.players).length,
        totalPlayers: totalCartelas,
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

 /* async function checkWinners(roomId, calledNumber) {
  const room = rooms[roomId];
  if (!room) return;
  const winners = [];
   const stakeAmount = Number(roomId); 
 const coinBonusForLoser = (stakeAmount * 0.01);
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
const winnerUsernames = new Set();
    for (const winner of winners) {
      const user = await BingoBord.findOne({ username: winner.winnerName });
      if (user) {
        user.Wallet += awardPerWinner;
        user.coins += 1;
        await user.save();
        await saveGameHistory(winner.winnerName, roomId, awardPerWinner, "win", room.gameId);
        winnerUsernames.add(winner.winnerName); 
      }
    }
  
    for (const clientId in room.players) {
      const username = room.players[clientId];
      
      // Check if the player is NOT in the winnerUsernames set
      if (!winnerUsernames.has(username)) {
        const user = await BingoBord.findOne({ username: username });
        
        if (user) {
          // The user is a loser (played but didn't win)
          // IMPORTANT: We use += for floating point numbers
          user.coins += coinBonusForLoser; 
          await user.save();

  // Existing logic to save loss history
 await saveGameHistory(username, roomId, Number(roomId), "loss", room.gameId); 
 console.log(`Rewarded loser ${username} with ${coinBonusForLoser} coins.`);
 }
 }
 }

    io.to(roomId).emit("winningPattern", winners);

    setTimeout(() => {
      if (rooms[roomId]) {
        const room = rooms[roomId];
        
        // ✅ COMPREHENSIVE CLEANUP LOGIC:
        console.log(`Game ended in room ${roomId}. Checking if room should be cleaned up...`);
        
        // Check if room has active players with cartelas
        const playersWithCartelas = Object.values(room.playerCartelas).filter(
          arr => arr && arr.length > 0
        ).length;
        
        // Check if room has any players at all
        const totalPlayers = Object.keys(room.players).length;
        
        console.log(`Room ${roomId} status - Players with cartelas: ${playersWithCartelas}, Total players: ${totalPlayers}`);
        
        if (playersWithCartelas === 0) {
          // No players with cartelas left - full cleanup
          if (totalPlayers === 0) {
            // Room is completely empty - delete it
            console.log(`Room ${roomId} is empty. Deleting room.`);
            resetRoom(roomId);
            delete rooms[roomId];
          } else {
            // Room has players but no cartelas - reset but keep room
            console.log(`Room ${roomId} has ${totalPlayers} players but no cartelas. Resetting room.`);
            resetRoom(roomId);
          }
        } else {
          // Room still has players with cartelas - just reset game state
          console.log(`Room ${roomId} has ${playersWithCartelas} players with cartelas. Keeping room active.`);
          resetRoom(roomId);
        }
      }
    }, 4000);
  }
}  */

async function checkWinners(roomId, calledNumber) {
  const room = rooms[roomId];
  if (!room) return;
  const winners = [];
  const stakeAmount = Number(roomId);

  for (const clientId in room.playerCartelas) {
    const cartelas = room.playerCartelas[clientId];
    if (!cartelas || cartelas.length === 0) continue;

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
    const winnerUsernames = new Set();

    // 🚀 Immediately emit the winners — user sees result instantly
    

    // ⚙️ Continue background updates (async, non-blocking)
    Promise.all(winners.map(async (winner) => {
      const user = await BingoBord.findOne({ username: winner.winnerName });
      if (user) {
        user.Wallet += awardPerWinner;
        user.coins += 1;
        await user.save();
        await saveGameHistory(winner.winnerName, roomId, awardPerWinner, "win", room.gameId);
        winnerUsernames.add(winner.winnerName);
      }
    })).then(async () => {
      // Only save game history for losers without coin bonus
      await Promise.all(
        Object.keys(room.players)
          .filter(clientId => !winnerUsernames.has(room.players[clientId]))
          .map(async clientId => {
            const username = room.players[clientId];
            await saveGameHistory(username, roomId, Number(roomId), "loss", room.gameId);
          })
      );
    }).catch(err => console.error("Error during async updates:", err));
io.to(roomId).emit("winningPattern", winners);
    // 🧹 Cleanup delay as before
    setTimeout(() => {
      if (rooms[roomId]) {
        const room = rooms[roomId];

        console.log(`Game ended in room ${roomId}. Checking if room should be cleaned up...`);

        const playersWithCartelas = Object.values(room.playerCartelas).filter(
          arr => arr && arr.length > 0
        ).length;

        const totalPlayers = Object.keys(room.players).length;

        console.log(`Room ${roomId} status - Players with cartelas: ${playersWithCartelas}, Total players: ${totalPlayers}`);

        if (playersWithCartelas === 0) {
          if (totalPlayers === 0) {
            console.log(`Room ${roomId} is empty. Deleting room.`);
            resetRoom(roomId);
            delete rooms[roomId];
          } else {
            console.log(`Room ${roomId} has ${totalPlayers} players but no cartelas. Resetting room.`);
            resetRoom(roomId);
          }
        } else {
          console.log(`Room ${roomId} has ${playersWithCartelas} players with cartelas. Keeping room active.`);
          resetRoom(roomId);
        }
      }
    }, 3000);
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
app.use("/api", leaderboardRoutes);
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
