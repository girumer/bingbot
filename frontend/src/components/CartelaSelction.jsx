import React, { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import "./CartelaSelction.css";
import cartela from "./cartela.json";
import { useNavigate, useSearchParams } from "react-router-dom";
import socket from "../socket";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function CartelaSelction() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Get parameters from URL
  const usernameFromUrl = searchParams.get("username");
  const telegramIdFromUrl = searchParams.get("telegramId");
  const roomIdFromUrl = searchParams.get("roomId");
  const stakeFromUrl = Number(searchParams.get("stake")) || 0;
  
  // Use these parameters for your component's logic
  const username = usernameFromUrl;
  const telegramId = telegramIdFromUrl;
  const roomId = roomIdFromUrl; 
  const stake = stakeFromUrl; 
  
  // --- States ---
  const [selectedCartelas, setSelectedCartelas] = useState([]);
  const [finalSelectedCartelas, setFinalSelectedCartelas] = useState([]);
  const [timer, setTimer] = useState(null);
  const [wallet, setWallet] = useState(0);
  const [activeGame, setActiveGame] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // --- Generate clientId ---
  const getClientId = () => {
    let cid = localStorage.getItem("clientId");
    if (!cid) {
      cid = `${Date.now()}-${Math.random()}`;
      localStorage.setItem("clientId", cid);
    }
    return cid;
  };
  const clientId = getClientId();

  // Fetch wallet data function
  const fetchWalletData = async () => {
    try {
      console.log("Fetching wallet data for Telegram ID:", telegramId);
      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/depositcheckB`,
        { telegramId }
      );
      
      let walletValue;
      if (typeof response.data === 'object' && response.data !== null) {
        walletValue = response.data.wallet || response.data.balance || 0;
      } else if (typeof response.data === 'number') {
        walletValue = response.data;
      } else if (typeof response.data === 'string' && !isNaN(response.data)) {
        walletValue = parseFloat(response.data);
      } else {
        console.error("Unexpected response format:", response.data);
        walletValue = 0;
      }
      setWallet(walletValue);
      return walletValue;
    } catch (err) {
      console.error("Failed to fetch wallet data:", err.response ? err.response.data : err.message);
      toast.error("Failed to load wallet data.");
      return 0;
    }
  };

  // --- MAIN INITIALIZATION EFFECT ---
  useEffect(() => {
    // Check if we have all required parameters
    if (!roomId || !username || !telegramId) {
      console.log("Waiting for all required URL parameters...");
      setIsLoading(false);
      return;
    }

    const initializeGame = async () => {
      try {
        // Fetch wallet data
        await fetchWalletData();

        // Join the game room
        socket.emit("joinRoom", {
          roomId,
          username,
          telegramId,
          clientId,
        });
      } catch (err) {
        console.error("Failed to initialize. Error:", err.response ? err.response.data : err.message);
        toast.error("Failed to initialize game. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };
    
    initializeGame();

    const handleGameState = (state) => {
      setFinalSelectedCartelas(Array.from(new Set(state.selectedIndexes || [])));
      setSelectedCartelas((prev) =>
        prev.filter((idx) => !(state.selectedIndexes || []).includes(idx))
      );
      if (state.timer != null) setTimer(state.timer);
      if (state.activeGame != null) setActiveGame(state.activeGame);
    };
    socket.on("currentGameState", handleGameState);

    return () => {
      socket.off("currentGameState", handleGameState);
    };
  }, [roomId, username, telegramId, clientId, stake]);

  // Listen for wallet updates from server
  useEffect(() => {
    const handleWalletUpdate = ({ wallet: updatedWallet }) => {
      if (updatedWallet !== undefined && updatedWallet !== null) {
        setWallet(updatedWallet);
      }
    };
    
    socket.on("walletUpdate", handleWalletUpdate);
    return () => socket.off("walletUpdate", handleWalletUpdate);
  }, []);

  // --- Other Socket event listeners ---
  useEffect(() => {
    const onCartelaAccepted = ({ cartelaIndex, Wallet: updatedWallet }) => {
      setSelectedCartelas((prev) => prev.filter((idx) => idx !== cartelaIndex));
      setFinalSelectedCartelas((prev) =>
        Array.from(new Set([...prev, cartelaIndex]))
      );
      if (updatedWallet != null) setWallet(updatedWallet);
    };
    
    const onCartelaError = ({ message }) => toast.error(message || "Cartela selection error");
    
    const onCountdown = (seconds) => setTimer(seconds);
    
    const onCountdownEnd = (cartelasFromServer) => {
      if (!cartelasFromServer || cartelasFromServer.length === 0) {
        toast.error("You did not select any cartela. Please select at least one.");
        return;
      }
      
      localStorage.setItem("myCartelas", JSON.stringify(cartelasFromServer));
      
      // Navigate with all parameters in state AND in URL
      const queryString = new URLSearchParams({
        username,
        telegramId,
        roomId,
        stake
      }).toString();
      
      navigate(`/BingoBoard?${queryString}`, {
        state: { 
          username, 
          roomId, 
          stake, 
          myCartelas: cartelasFromServer,
          telegramId
        },
      });
    };
    
    const onUpdateSelectedCartelas = ({ selectedIndexes }) => {
      setFinalSelectedCartelas((prev) => Array.from(new Set([...prev, ...selectedIndexes])));
      setSelectedCartelas((prev) => prev.filter((idx) => !selectedIndexes.includes(idx)));
    };
    
    const onActiveGameStatus = ({ activeGame }) => setActiveGame(activeGame);
    
    const onCartelaRejected = ({ message }) => toast.error(message || "Cannot select this cartela");
    
    const onRoomAvailable = () => {
      setActiveGame(false);
      setSelectedCartelas([]);
      setFinalSelectedCartelas([]);
      setTimer(null);
      
      // Refresh wallet data when room becomes available again
      fetchWalletData();
    };
    
    socket.on("cartelaAccepted", onCartelaAccepted);
    socket.on("cartelaError", onCartelaError);
    socket.on("startCountdown", onCountdown);
    socket.on("myCartelas", onCountdownEnd);
    socket.on("updateSelectedCartelas", onUpdateSelectedCartelas);
    socket.on("activeGameStatus", onActiveGameStatus);
    socket.on("cartelaRejected", onCartelaRejected);
    socket.on("roomAvailable", onRoomAvailable);

    return () => {
      socket.off("cartelaAccepted", onCartelaAccepted);
      socket.off("cartelaError", onCartelaError);
      socket.off("startCountdown", onCountdown);
      socket.off("myCartelas", onCountdownEnd);
      socket.off("updateSelectedCartelas", onUpdateSelectedCartelas);
      socket.off("activeGameStatus", onActiveGameStatus);
      socket.off("cartelaRejected", onCartelaRejected);
      socket.off("roomAvailable", onRoomAvailable);
    };
  }, [navigate, roomId, username, stake, telegramId]);

  // --- Button Handlers ---
  const handleButtonClick = (index) => {
    if (activeGame) return toast.error("Game in progress – wait until it ends");
    if (finalSelectedCartelas.includes(index)) return;
    
    // Check if user has enough balance
    if (wallet < stake) {
      toast.error("Insufficient balance to select cartela");
      return;
    }
    
    setSelectedCartelas((prev) => {
      if (prev.includes(index)) return prev.filter((i) => i !== index);
      if (prev.length >= 4) {
        toast.error("You can only select up to 4 cartelas");
        return prev;
      }
      return [...prev, index];
    });
  };
  
  const handleAddCartela = () => {
    if (activeGame) return toast.error("Cannot add cartela – game in progress");
    if (!selectedCartelas.length) return toast.error("Select at least one cartela first");
    if (wallet < stake * selectedCartelas.length) {
      toast.error("Insufficient balance for selected cartelas");
      return;
    }
    
    selectedCartelas.forEach((idx) => {
      socket.emit("selectCartela", { roomId, cartelaIndex: idx, clientId });
    });
    setSelectedCartelas([]);
  };

  // --- Render based on loading state ---
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-lg">
        Loading...
      </div>
    );
  }

  return (
    <React.Fragment>
      <div className="Cartelacontainer-wrapper">
        <div className="wallet-stake-display">
          <div className="display-btn">Wallet: {wallet} ETB</div>
          <div className="display-btn">Active Game: {activeGame ? "Yes" : "No"}</div>
          <div className="display-btn">Stake: {stake} ETB</div>
        </div>
        
        {timer !== null && <div className="timer-display">Time Remaining: {timer}s</div>}
        
        <div className="Cartelacontainer">
          {cartela.map((_, index) => {
            const isTakenByOthers = finalSelectedCartelas.includes(index);
            const isSelectedByMe = selectedCartelas.includes(index);
            return (
              <button
                key={`cartela-btn-${index}`}
                onClick={() => handleButtonClick(index)}
                className="cartela"
                style={{
                  background: isTakenByOthers ? "red" : isSelectedByMe ? "yellow" : "#eeeeee",
                  color: isTakenByOthers || isSelectedByMe ? "white" : "black",
                  cursor: isTakenByOthers || activeGame ? "not-allowed" : "pointer",
                }}
                disabled={isTakenByOthers || activeGame || wallet < stake}
              >
                {index + 1}
              </button>
            );
          })}
        </div>
        
        {selectedCartelas.length > 0 && (
          <div className="pending-cartelas">
            {selectedCartelas.map((idx, i) => (
              <div key={`pending-${idx}-${i}`} className="cartela-display1 pending">
                {cartela[idx].cart.map((row, rowIndex) => (
                  <div key={rowIndex} className="cartela-row1">
                    {row.map((cell, cellIndex) => (
                      <span key={cellIndex} className="cartela-cell1">
                        {cell}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
        
        <div className="buttonconfirm">
          <button
            className="game_start"
            disabled={!selectedCartelas.length || activeGame || wallet < stake * selectedCartelas.length}
            onClick={handleAddCartela}
          >
            Add Cartela(s) - Cost: {stake * selectedCartelas.length} ETB
          </button>
        </div>
      </div>
      <ToastContainer />
    </React.Fragment>
  );
}

export default CartelaSelction;