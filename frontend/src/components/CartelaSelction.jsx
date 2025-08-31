import React, { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import "./CartelaSelction.css";
import cartela from "./cartela.json";
import { useSearchParams, useNavigate, useOutletContext } from "react-router-dom";
import socket from "../socket";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function CartelaSelction() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { usernameFromUrl, telegramIdFromUrl } = useOutletContext();

  // --- Use parameters from context or URL as fallback ---
  const usernameParam = usernameFromUrl || searchParams.get("username");
  const roomId = searchParams.get("roomId");
  const telegramIdParam = telegramIdFromUrl || searchParams.get("telegramId");
  const stake = Number(searchParams.get("stake")) || 0;

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

  // --- Telegram WebApp ready check ---
  useEffect(() => {
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      console.log("Telegram Web App ready", tg.initData);
    } else {
      console.warn("Telegram WebApp not available");
    }
  }, []);

  // --- MAIN INITIALIZATION EFFECT ---
  // This hook will only run when all required data is available
  useEffect(() => {
    // Wait until all parameters are present
    if (!roomId || !usernameParam || !telegramIdParam) {
      console.log("Frontend: Waiting for all required URL parameters...");
      return;
    }

    const initializeGame = async () => {
      try {
        // 1. Fetch wallet balance
        console.log("Frontend: Sending request for wallet balance with Telegram ID:", telegramIdParam);
        const response = await axios.post(
          `${process.env.REACT_APP_BACKEND_URL}/depositcheckB`,
          { telegramId: telegramIdParam } 
        );
        
        console.log("Frontend: Raw response data from server:", response.data);
        const walletValue = Number(response.data);
        if (isNaN(walletValue)) {
            console.error("Frontend: Received non-numeric wallet value:", response.data);
            toast.error("Invalid wallet data received.");
            setWallet(0);
        } else {
            setWallet(walletValue);
        }

        // 2. Join the game room
        socket.emit("joinRoom", {
          roomId,
          username: usernameParam,
          telegramId: telegramIdParam,
          clientId,
          
        });

      } catch (err) {
        console.error("Frontend: Failed to initialize. Error:", err.response ? err.response.data : err.message);
        toast.error("Failed to load user data. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    initializeGame();

    // Set up socket event listeners
    const handleGameState = (state) => {
      setFinalSelectedCartelas(Array.from(new Set(state.selectedIndexes || [])));
      setSelectedCartelas((prev) =>
        prev.filter((idx) => !(state.selectedIndexes || []).includes(idx))
      );
      if (state.timer != null) setTimer(state.timer);
      if (state.activeGame != null) setActiveGame(state.activeGame);
    };
    socket.on("currentGameState", handleGameState);
    
    // Clean up
    return () => {
        socket.off("currentGameState", handleGameState);
    };

  }, [roomId, usernameParam, telegramIdParam, clientId, stake]);

  // --- Separate Socket events (for cleaner logic) ---
  useEffect(() => {
    const onCartelaAccepted = ({ cartelaIndex, Wallet: updatedWallet }) => {
      setSelectedCartelas((prev) => prev.filter((idx) => idx !== cartelaIndex));
      setFinalSelectedCartelas((prev) =>
        Array.from(new Set([...prev, cartelaIndex]))
      );
      if (updatedWallet != null) setWallet(updatedWallet);
    };

    const onCartelaError = ({ message }) =>
      toast.error(message || "Cartela selection error");

    const onCountdown = (seconds) => setTimer(seconds);

    const onCountdownEnd = (cartelasFromServer) => {
      if (!cartelasFromServer || cartelasFromServer.length === 0) {
        toast.error("You did not select any cartela. Please select at least one.");
        return;
      }
      localStorage.setItem("myCartelas", JSON.stringify(cartelasFromServer));
      navigate("/BingoBoard", {
        state: { 
          username: usernameParam, 
          roomId, 
          stake, 
          myCartelas: cartelasFromServer,
          telegramId: telegramIdParam 
        },
      });
    };

    const onUpdateSelectedCartelas = ({ selectedIndexes }) => {
      setFinalSelectedCartelas((prev) =>
        Array.from(new Set([...prev, ...selectedIndexes]))
      );
      setSelectedCartelas((prev) =>
        prev.filter((idx) => !selectedIndexes.includes(idx))
      );
    };

    const onActiveGameStatus = ({ activeGame }) => setActiveGame(activeGame);
    const onCartelaRejected = ({ message }) =>
      toast.error(message || "Cannot select this cartela");

    socket.on("cartelaAccepted", onCartelaAccepted);
    socket.on("cartelaError", onCartelaError);
    socket.on("startCountdown", onCountdown);
    socket.on("myCartelas", onCountdownEnd);
    socket.on("updateSelectedCartelas", onUpdateSelectedCartelas);
    socket.on("activeGameStatus", onActiveGameStatus);
    socket.on("cartelaRejected", onCartelaRejected);

    return () => {
      socket.off("cartelaAccepted", onCartelaAccepted);
      socket.off("cartelaError", onCartelaError);
      socket.off("startCountdown", onCountdown);
      socket.off("myCartelas", onCountdownEnd);
      socket.off("updateSelectedCartelas", onUpdateSelectedCartelas);
      socket.off("activeGameStatus", onActiveGameStatus);
      socket.off("cartelaRejected", onCartelaRejected);
    };
  }, [navigate, roomId, usernameParam, stake, telegramIdParam]);

  // --- Button Handlers ---
  const handleButtonClick = (index) => {
    if (activeGame) return toast.error("Game in progress – wait until it ends");
    if (finalSelectedCartelas.includes(index)) return;

    setSelectedCartelas((prev) => {
      if (prev.includes(index)) return prev.filter((i) => i !== index);
      if (prev.length >= 4) {
        toast.error("You can only select up to 4 cartelas");
        return prev;
      }
      return [...prev, index];
    });
  };

  const handleAddCartela = async () => {
    if (activeGame) return toast.error("Cannot add cartela – game in progress");
    if (!selectedCartelas.length) return toast.error("Select at least one cartela first");
    if (!telegramIdParam) {
      toast.error("User not found. Cannot proceed.");
      return;
    }

    try {
      const deductResponse = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/deductCoins`,
        { telegramId: telegramIdParam, stake: stake }
      );

      if (deductResponse.data.success) {
        selectedCartelas.forEach((idx) => {
          socket.emit("selectCartela", { roomId, cartelaIndex: idx, clientId });
        });
        setSelectedCartelas([]);
      } else {
        toast.error(deductResponse.data.message || "Failed to deduct coins. Please try again.");
      }
    } catch (err) {
      console.error("Failed to deduct coins:", err);
      toast.error("Failed to finalize selection. Please try again.");
    }
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
          <div className="display-btn">Wallet: {wallet}</div>
          <div className="display-btn">Active Game: {activeGame ? "Yes" : "No"}</div>
          <div className="display-btn">Stake: {stake}</div>
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
                disabled={isTakenByOthers || activeGame}
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
            disabled={!selectedCartelas.length}
            onClick={handleAddCartela}
          >
            Add Cartela(s)
          </button>
        </div>
      </div>
      <ToastContainer />
    </React.Fragment>
  );
}

export default CartelaSelction;
