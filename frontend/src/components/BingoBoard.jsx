import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate,useSearchParams } from "react-router-dom";
import "./BingoBoard.css";
import cartela from "./cartela.json";
import socket from "../socket";
import { toast, ToastContainer } from "react-toastify";

// Determine prefix letter for a number
function getBingoLetter(num) {
  if (num >= 1 && num <= 15) return "B";
  if (num >= 16 && num <= 30) return "I";
  if (num >= 31 && num <= 45) return "N";
  if (num >= 46 && num <= 60) return "G";
  if (num >= 61 && num <= 75) return "O";
  return "";
}

// My Cartelas Section
function MyCartelasSection({
  myCartelas,
  selectedIndexes,
  clickedNumbers,
  toggleNumber,
  winners,
  highlightCartelas,   // ✅ new prop
  allCalledNumbers 
}) {
  if (!myCartelas || myCartelas.length === 0) return null;

  const renderCartela = (cartelaItem, idx) => {
    const cartelaIndex =
      typeof cartelaItem === "number" ? cartelaItem : cartelaItem.index;

    if (!cartela[cartelaIndex]) return null;

    const grid =
      typeof cartelaItem === "number"
        ? cartela[cartelaIndex]?.cart
        : cartelaItem?.grid;

    if (!grid) return null;

    const winner = winners.find((w) => w.cartelaIndex === cartelaIndex);

    // ✅ Fixed winning cell detection
    // ✅ Fixed winning cell detection
// ✅ Fixed winning cell detection - compare by number values
// ✅ Fixed winning cell detection - compare by number values
const isWinningCell = (cell, rowIndex, cellIndex, pattern) => {
  if (!pattern) return false;

  // Handle wildcard - only match the center cell (position [2,2])
  if (pattern.includes("*") && rowIndex === 2 && cellIndex === 2) return true;

  // Highlight numbers in pattern
  const cellNumber = Number(cell);
  if (pattern.some(p => typeof p === "number" && p === cellNumber)) return true;

  return false;
};
    return (
      <div className="cartela-display">
        <div className="cartela-header">
          {["B", "I", "N", "G", "O"].map((letter, i) => (
            <div key={i} className={`cartela-header-cell ${letter.toLowerCase()}`}>
              {letter}
            </div>
          ))}
        </div>

        <div className="cartela-rows-container">
          {grid.map((row, rowIndex) => {
            const normalizedRow =
              Array.isArray(row) && row.length === 5 ? row : Array(5).fill(null);

            return (
              <div key={rowIndex} className="cartela-row">
                {normalizedRow.map((cell, cellIndex) => (
                 <button
  key={cellIndex}
  className={`cartela-cell 
    ${clickedNumbers.includes(cell) ? "clicked" : ""} 
    ${highlightCartelas && allCalledNumbers.includes(cell) ? "highlighted" : ""} 
    ${isWinningCell(cell, rowIndex, cellIndex, winner?.pattern) ? "winner-highlight" : ""}`}
  onClick={() => cell && toggleNumber(cell)}
  disabled={!cell}
>
  {cell || ""}
</button>

                ))}
              </div>
            );
          })}
        </div>

        <div className="cartela-index">card number {cartelaIndex+1}</div>

        <button className="bingo-button" onClick={() => toast.error("u click wrong pattern")}>
          Bingo
        </button>
      </div>
    );
  };

  return (
    <div className="my-cartelas">
      <div className="cartelas-container-horizontal">
        {myCartelas.map((c, idx) => renderCartela(c, idx))}
      </div>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
    </div>
  );
}

function BingoBoard() {
  const location = useLocation();
  const navigate = useNavigate();
const [searchParams] = useSearchParams();
 // const storedCartelas = JSON.parse(localStorage.getItem("myCartelas") || "[]");
// const { username, roomId, myCartelas: initialCartelas } = location.state || {};
const usernameFromState = location.state?.username;
  const roomIdFromState = location.state?.roomId;
  const telegramIdFromState = location.state?.telegramId;
  const usernameFromUrl = searchParams.get("username");
  const roomIdFromUrl = searchParams.get("roomId");
  const telegramIdFromUrl = searchParams.get("telegramId");
  const stakeFromUrl = Number(searchParams.get("stake")) || 0;
  const username = usernameFromState || usernameFromUrl;
  const roomId = roomIdFromState || roomIdFromUrl;
  const telegramId = telegramIdFromState || telegramIdFromUrl;
  const stake = location.state?.stake || stakeFromUrl;
  const storedCartelas = JSON.parse(localStorage.getItem("myCartelas") || "[]");
  const { myCartelas: initialCartelas } = location.state || {};
 //const [myCartelas, setMyCartelas] = useState(initialCartelas || storedCartelas);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [ gameId,setGameId]=useState(null);
    const [highlightCartelas, setHighlightCartelas] = useState(true);
  const [myCartelas, setMyCartelas] = useState(initialCartelas || storedCartelas);
  const [allCalledNumbers, setAllCalledNumbers] = useState([]);
  const [lastNumber, setLastNumber] = useState(null);
  const [selectedIndexes, setSelectedIndexes] = useState([]);
  const [highlightedNumbers, setHighlightedNumbers] = useState([]);
  const [clickedNumbers, setClickedNumbers] = useState([]);
  const [timer, setTimer] = useState(null);
  const [totalAward, setTotalAward] = useState(null);
  const [winners, setWinners] = useState([]);
  const [showPopup, setShowPopup] = useState(false);
  const [iAmWinner, setIAmWinner] = useState(false);

  const gameIdRef = useRef(`${roomId}-${Date.now()}`);

  const getClientId = () => {
    let cid = localStorage.getItem("clientId");
    if (!cid) {
      cid = `${Date.now()}-${Math.random()}`;
      localStorage.setItem("clientId", cid);
    }
    return cid;
  };
  const clientId = getClientId();

  const letters = ["B", "I", "N", "G", "O"];
  const numberColumns = [
    Array.from({ length: 15 }, (_, i) => i + 1),
    Array.from({ length: 15 }, (_, i) => i + 16),
    Array.from({ length: 15 }, (_, i) => i + 31),
    Array.from({ length: 15 }, (_, i) => i + 46),
    Array.from({ length: 15 }, (_, i) => i + 61),
  ];

  const toggleNumber = (num) => {
    setClickedNumbers((prev) =>
      prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num]
    );
  };
  const refreshpg = () => {
    // This command will reload the entire page from the server
    window.location.reload();
};
  // ✅ Corrected code in BingoBoard.js
// ✅ Corrected reset handler in BingoBoard.js
useEffect(() => {
  const handleReset = () => {
    // Create query string with all necessary parameters
    const queryString = new URLSearchParams({
      username,
      telegramId,
      roomId: String(roomId),
      stake: String(stake || 0),
    }).toString();
    
    // Navigate with both state and query parameters
    navigate(`/CartelaSelction?${queryString}`, {
      state: { username, telegramId, roomId, stake }
    });
  };

  socket.on("resetRoom", handleReset);
  return () => socket.off("resetRoom", handleReset);
}, [navigate, username, roomId, stake, telegramId]);
useEffect(() => {
    if (!username || !telegramId) {
      console.error("Missing authentication parameters");
      toast.error("Authentication required. Redirecting...");
      setTimeout(() => navigate("/"), 2000);
      return;
    }
    
    // Store parameters for future use
    localStorage.setItem("username", username);
    localStorage.setItem("telegramId", telegramId);
  }, [username, telegramId, navigate]);
  // --- SOCKETS ---
  useEffect(() => {
    if (!roomId) return;
    socket.emit("joinRoom", { roomId, username, telegramId,clientId });

    const handleGameState = (state) => {
      setAllCalledNumbers(state.calledNumbers || []);
      setHighlightedNumbers(state.calledNumbers || []);
      setLastNumber(state.lastNumber || null);
      if (state.countdown != null) setTimer(state.countdown);
      setSelectedIndexes(state.selectedIndexes || []);
      if (state.totalAward != null) setTotalAward(state.totalAward);
      if (state.gameId != null) setGameId(state.gameId);
    };

    socket.on("currentGameState", handleGameState);
    return () => socket.off("currentGameState", handleGameState);
  }, [roomId, username, clientId]);

  useEffect(() => {
    const handleMyCartelas = (cartelasFromServer) => {
      setMyCartelas(cartelasFromServer);
      localStorage.setItem("myCartelas", JSON.stringify(cartelasFromServer));
    };
    socket.on("myCartelas", handleMyCartelas);
    return () => socket.off("myCartelas", handleMyCartelas);
  }, []);

  useEffect(() => {
    const handlePlayerCount = ({ totalPlayers }) => setTotalPlayers(totalPlayers);
    socket.on("playerCount", handlePlayerCount);
    return () => socket.off("playerCount", handlePlayerCount);
  }, []);

// In your BingoBoard component
useEffect(() => {
    const handleGameStarted = ({ totalAward, totalPlayers, gameId }) => {
        setTotalAward(totalAward);
        setTotalPlayers(totalPlayers);
        setGameId(gameId);
        toast.success(`Game started! Game ID: ${gameId}`);
    };
    socket.on("gameStarted", handleGameStarted);
    return () => socket.off("gameStarted", handleGameStarted);
}, []);

  useEffect(() => {
    const handleWinningPattern = (winnersArr) => {
      console.log("WINNERS PAYLOAD:", JSON.stringify(winnersArr, null, 2));
      setWinners(winnersArr);
      const mine = winnersArr.some((w) => w.clientId === clientId);
      setIAmWinner(mine);
      setShowPopup(true);
      setTimeout(() => setShowPopup(false), 5000);
    };
    socket.on("winningPattern", handleWinningPattern);
    return () => socket.off("winningPattern", handleWinningPattern);
  }, [clientId]);

  useEffect(() => {
    const handleNumberCalled = (number) => {
      setLastNumber(number);
      setAllCalledNumbers((prev) => [...prev, number]);
      setHighlightedNumbers((prev) => [...prev, number]);
    };

    const handleSelectedIndexes = ({ selectedIndexes }) =>
      setSelectedIndexes(selectedIndexes);

    const handleStartCountdown = (seconds) => setTimer(seconds);

    socket.on("numberCalled", handleNumberCalled);
    socket.on("updateSelectedCartelas", handleSelectedIndexes);
    socket.on("startCountdown", handleStartCountdown);

    return () => {
      socket.off("numberCalled", handleNumberCalled);
      socket.off("updateSelectedCartelas", handleSelectedIndexes);
      socket.off("startCountdown", handleStartCountdown);
    };
  }, []);



  return (
    <div className="bingo-board-wrapper">
      {/* TOP STATS */}
      <div className="top-stats">
         <div className="stat-button">
            
            GameID {gameId || "Waiting..."}
          </div>
        <div className="stat-button">
          💰 Prize{" "}
          {totalAward !== null ? totalAward.toLocaleString() + " ETB" : "Loading..."}
        </div>
   
        <div className="stat-button">👥 Players {totalPlayers}</div>
        <div className="stat-button">🔢 {allCalledNumbers.length}/75</div>
      </div>

      {/* MIDDLE NUMBERS GRID */}
      <div className="numbers-grid-wrapper">

        <div className="toggle-container">
    <span className="toggle-label">AUTO SELECT</span>
    <label className="toggle-switch">
      <input
        type="checkbox"
        checked={highlightCartelas}
        onChange={() => setHighlightCartelas(!highlightCartelas)}
      />
      <span className="toggle-slider"></span>
    </label>
    <div className="stat-button1" onClick={refreshpg}>REFRESH</div>
    </div>
    
    
        {lastNumber !== null && (
          <div className="last-called-number">
             <span 
      className="last-called-letter" 
      data-letter={getBingoLetter(lastNumber)}
    >
      {getBingoLetter(lastNumber)}-
    </span>
            {lastNumber}
            </div>
        )}

        <div className="last-five-display">
          {allCalledNumbers.slice(-5).map((num, idx) => (
            <div key={idx} className={`last-five-number ${getBingoLetter(num).toLowerCase()}`}>
              <span className="last-five-letter">{getBingoLetter(num)}-</span>
              {num}
            </div>
          ))}
        </div>

        {letters.map((letter, rowIndex) => (
          <div key={letter} className="number-row">
            <div className="letter-button">{letter}</div>
            {numberColumns[rowIndex].map((num) => (
              <button
                key={num}
                className={`number-button ${highlightedNumbers.includes(num) ? "called" : ""}`}
                disabled
              >
                {num}
              </button>
            ))}
          </div>
        ))}
        
      </div>

      
      {/* BOTTOM PANELS */}
      <div className="bottom-panels">
        <div className="bottom-left">
          <MyCartelasSection
            myCartelas={myCartelas}
            selectedIndexes={selectedIndexes}
            clickedNumbers={clickedNumbers}
            toggleNumber={toggleNumber}
            winners={winners}
             highlightCartelas={highlightCartelas}  // ✅ pass toggle
             allCalledNumbers={allCalledNumbers} 
          />
        </div>
        <div className="bottom-right">{/* Optional: last five numbers, timer, stats */}</div>
      </div>

      {/* WINNER POPUP */}
    
{showPopup && (
  <div className="winner-popup">
    <h2>{iAmWinner ? "🎉 You won! 🎉" : "Winner(s)!"}</h2>
    <div className="cartelas-container-horizontal winner-cartelas-container">
      {winners.map((w, idx) => {
        const winnerCartela = cartela[w.cartelaIndex];
        if (!winnerCartela) return null;

        // ✅ Use the winner's pattern directly
        const pattern = w.pattern;

        return (
          <div key={idx} className="cartela-display winner-cartela">
            <div className="cartela-header">
              {["B", "I", "N", "G", "O"].map((letter, i) => (
                <div key={i} className={`cartela-header-cell ${letter.toLowerCase()}`}>
                  {letter}
                </div>
              ))}
            </div>

            <div className="cartela-rows-container">
              {winnerCartela.cart.map((row, rowIndex) => (
                <div key={rowIndex} className="cartela-row">
                  {row.map((cell, cellIndex) => {
                    // ✅ CORRECTED: Check if this cell is part of the winning pattern
                    const isWinning = pattern && cell && pattern.some((p) => {
                      // Handle wildcard - only match the center cell (position [2,2])
                      if (p === "*" && rowIndex === 2 && cellIndex === 2) return true;
                      
                      // Handle numbers
                      if (typeof p === "number" && Number(cell) === p) return true;
                      
                      return false;
                    });

                    return (
                      <button
                        key={cellIndex}
                        className={`cartela-cell ${isWinning ? "winner-highlight" : ""}`}
                        disabled
                        style={{ color: cell > 0 ? "black" : "red" }}
                      >
                        {cell}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="cartela-index">{w.winnerName}</div>
          </div>
        );
      })}
    </div>
  </div>
)}

    </div>
  );
}

export default BingoBoard;
