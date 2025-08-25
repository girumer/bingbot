import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./BingoBoard.css";
import cartela from "./cartela.json";
import socket from "../socket";
import { toast,ToastContainer } from "react-toastify";

// Determine prefix letter for a number
function getBingoLetter(num) {
  if (num >= 1 && num <= 15) return "B";
  if (num >= 16 && num <= 30) return "I";
  if (num >= 31 && num <= 45) return "N";
  if (num >= 46 && num <= 60) return "G";
  if (num >= 61 && num <= 75) return "O";
  return "";
}

// Determine CSS class for background color
function getBingoClass(num) {
  const letter = getBingoLetter(num);
  return letter.toLowerCase(); // b, i, n, g, o
}

// BINGO grid for left panel
function BingoGrid({ letters, numberColumns, highlightedNumbers }) {
  return (
    <div className="numbers-columns">
      {letters.map((letter, colIndex) => (
        <div key={letter} className="number-column">
          <div className="letter-button">{letter}</div>
          {numberColumns[colIndex].map((num) => (
            <button
              key={num}
              className={`number-button ${
                highlightedNumbers.includes(num) ? "called" : ""
              }`}
              disabled
            >
              {num}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

// My Cartelas Section
// My Cartelas Section
function MyCartelasSection({
  myCartelas,
  selectedIndexes,
  clickedNumbers,
  toggleNumber,
  winners,
}) {
  if (!myCartelas || myCartelas.length === 0) return null;

  const letters = ["B", "I", "N", "G", "O"];

  const renderCartela = (cartelaItem, idx) => {
  const cartelaIndex = typeof cartelaItem === "number" ? cartelaItem : cartelaItem.index;

  // Safety check: stop rendering if data missing
  if (!cartela[cartelaIndex]) return null;

  const grid = typeof cartelaItem === "number" ? cartela[cartelaIndex]?.cart : cartelaItem?.grid;

  if (!grid) return null;

  const winner = winners.find((w) => w.cartelaIndex === cartelaIndex);

  const isWinningCell = (cell) => {
    return winner && winner.pattern.includes(cell);
  };

  return (
    <div
      key={idx}
      className={`cartela-display ${
        selectedIndexes.includes(cartelaIndex) ? "selected-cartela" : ""
      }`}
    >
      {/* B-I-N-G-O Header */}
      <div className="cartela-header">
        {["B", "I", "N", "G", "O"].map((letter, i) => (
          <div key={i} className={`cartela-header-cell ${letter.toLowerCase()}`}>
            {letter}
          </div>
        ))}
      </div>

      {/* Numbers Grid */}
      {grid.map((row, rowIndex) => (
        <div key={rowIndex} className="cartela-row">
          {row.map((cell, cellIndex) => (
            <button
              key={cellIndex}
              className={`cartela-cell 
                ${clickedNumbers.includes(cell) ? "clicked" : ""} 
                ${isWinningCell(cell) ? "winner-highlight" : ""}`}
              onClick={() => toggleNumber(cell)}
            >
              {cell}
            </button>
          ))}
        </div>
      ))}

      {/* Cartela Index */}
      <div className="cartela-index">card number {cartelaIndex}</div>

      {/* Bingo Button */}
      <button className="bingo-button" onClick={() => toast.error("Checking")}>
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

  const storedCartelas = JSON.parse(localStorage.getItem("myCartelas") || "[]");
  const { username, roomId, myCartelas: initialCartelas } =
    location.state || {};
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [myCartelas, setMyCartelas] = useState(
    initialCartelas || storedCartelas
  );
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

  const lastFive = allCalledNumbers.slice(-5).reverse();

  // --- JOIN ROOM ---
  useEffect(() => {
    if (!roomId) return;
    socket.emit("joinRoom", { roomId, username, clientId });

    const handleGameState = (state) => {
      setAllCalledNumbers(state.calledNumbers || []);
      setHighlightedNumbers(state.calledNumbers || []);
      setLastNumber(state.lastNumber || null);
      if (state.countdown != null) setTimer(state.countdown);
      setSelectedIndexes(state.selectedIndexes || []);
      if (state.totalAward != null) setTotalAward(state.totalAward);
    };

    socket.on("currentGameState", handleGameState);
    return () => socket.off("currentGameState", handleGameState);
  }, [roomId, username, clientId]);

  // --- CARTELAS ---
  useEffect(() => {
    const handleMyCartelas = (cartelasFromServer) => {
      setMyCartelas(cartelasFromServer);
      localStorage.setItem("myCartelas", JSON.stringify(cartelasFromServer));
    };
    socket.on("myCartelas", handleMyCartelas);
    return () => socket.off("myCartelas", handleMyCartelas);
  }, []);

  // --- PLAYER COUNT ---
  useEffect(() => {
    const handlePlayerCount = ({ totalPlayers }) =>
      setTotalPlayers(totalPlayers);
    socket.on("playerCount", handlePlayerCount);
    return () => socket.off("playerCount", handlePlayerCount);
  }, []);

  // --- GAME STARTED ---
  useEffect(() => {
    const handleGameStarted = ({ totalAward, totalPlayers }) => {
      setTotalAward(totalAward);
      setTotalPlayers(totalPlayers);
    };
    socket.on("gameStarted", handleGameStarted);
    return () => socket.off("gameStarted", handleGameStarted);
  }, []);

  // --- WINNING PATTERN ---
  useEffect(() => {
    const handleWinningPattern = (winnersArr) => {
      setWinners(winnersArr);
      const mine = winnersArr.some((w) => w.clientId === clientId);
      setIAmWinner(mine);
      setShowPopup(true);
      setTimeout(() => setShowPopup(false), 5000);
    };

    socket.on("winningPattern", handleWinningPattern);
    return () => socket.off("winningPattern", handleWinningPattern);
  }, [clientId]);

  // --- EVENTS ---
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

  // --- RESET ---
  useEffect(() => {
    const handleReset = () =>
      navigate("/CartelaSelction", { state: { username, roomId } });
    socket.on("resetRoom", handleReset);
    return () => socket.off("resetRoom", handleReset);
  }, [navigate, username, roomId]);

  return (
    <div className="bingo-board-wrapper">
      {/* LEFT PANEL */}
      <div className="left-board panel">
        <div className="panel-header">
          <div className="stat-button">
            <span className="stat-label">💰 Total Prize</span>
            <span className="stat-value">
              {totalAward !== null
                ? totalAward.toLocaleString() + " ETB"
                : "Loading..."}
            </span>
          </div>
        </div>
        <div className="panel-body">
          
          <BingoGrid
            letters={letters}
            numberColumns={numberColumns}
            highlightedNumbers={highlightedNumbers}
          />
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="right-panel panel">
        <div className="panel-header">
          <div className="stat-button">
            <span className="stat-label">👥 Players</span>
            <span className="stat-value">{totalPlayers}</span>
          </div>
          <div className="stat-button">
            <span className="stat-label">🔢 Called Numbers</span>
            <span className="stat-value">{allCalledNumbers.length}</span>
          </div>
        </div>
        <div className="panel-body">
          {timer !== null && (
            <div className="timer-display">Time Remaining: {timer}s</div>
          )}

          <div className="last-number-display">
            {lastNumber !== null && (
              <div className={`called-number ${getBingoClass(lastNumber)}`}>
                {getBingoLetter(lastNumber)}-{lastNumber}
              </div>
            )}
          </div>

          {/* Last Five Called Numbers */}
          <div className="called-numbers-wrapper">
            {lastFive.map((num, index) => {
              const letter = getBingoLetter(num);
              const className = getBingoClass(num);
              return (
                <div key={index} className={`called-number ${className}`}>
                  {letter}-{num}
                </div>
              );
            })}
          </div>

          {myCartelas && myCartelas.length > 0 ? (
            <MyCartelasSection
              myCartelas={myCartelas}
              selectedIndexes={selectedIndexes}
              clickedNumbers={clickedNumbers}
              toggleNumber={toggleNumber}
              winners={winners}
            />
          ) : (
            <div className="cartelas-placeholder">
              Waiting for your cartelas from the server...
            </div>
          )}
        </div>
      </div>

      {/* WINNER POPUP */}
    {/* WINNER POPUP */}
{showPopup && (
  <div className="winner-popup">
    <h2>Winner{winners.length > 1 ? "s" : ""}!</h2>
    {winners.map((w, idx) => {
      const winnerCartela = cartela[w.cartelaIndex];
      if (!winnerCartela) return null;

      const isWinningCell = (cell) => w.pattern.includes(cell);

      return (
        <div key={idx} className="cartela-display winner-cartela">
          {/* B-I-N-G-O Header */}
          <div className="cartela-header">
            {["B", "I", "N", "G", "O"].map((letter, i) => (
              <div key={i} className={`cartela-header-cell ${letter.toLowerCase()}`}>
                {letter}
              </div>
            ))}
          </div>

          {/* Numbers Grid */}
          {winnerCartela.cart.map((row, rowIndex) => (
            <div key={rowIndex} className="cartela-row">
              {row.map((cell, cellIndex) => (
                <button
                  key={cellIndex}
                  className={`cartela-cell 
                    ${clickedNumbers.includes(cell) ? "clicked" : ""} 
                    ${isWinningCell(cell) ? "winner-highlight" : ""}`}
                  onClick={() => toggleNumber(cell)}
                >
                  {cell}
                </button>
              ))}
            </div>
          ))}

          <div className="cartela-index">{w.winnerName}</div>
        </div>
      );
    })}
  </div>
)}

    </div>
  );
}

export default BingoBoard;
