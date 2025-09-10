import React, { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import "./CartelaSelction.css";
import cartela from "./cartela.json";
import { useNavigate, useSearchParams, useOutletContext } from "react-router-dom";
import socket from "../socket";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function CartelaSelction() {
  const navigate = useNavigate();
  const ctx = useOutletContext() || {};

  // 1) URL params
  const search = new URLSearchParams(window.location.search);
  const qp = {
    username: search.get("username"),
    telegramId: search.get("telegramId"),
    roomId: search.get("roomId"),
    stake: search.get("stake"),
  };

  // 2) Context (if present)
  const cx = {
    username: ctx.usernameFromUrl,
    telegramId: ctx.telegramIdFromUrl,
    roomId: ctx.roomIdFromUrl,
    stake: ctx.stakeFromUrl,
  };

  // 3) Telegram WebApp (if available)
  const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
  const tg = {
    username: tgUser?.username || undefined,
    telegramId: tgUser?.id ? String(tgUser.id) : undefined,
  };

  // 4) LocalStorage fallback
  const ls = {
    username: localStorage.getItem("username") || undefined,
    telegramId: localStorage.getItem("telegramId") || undefined,
    roomId: localStorage.getItem("roomId") || undefined,
    stake: localStorage.getItem("stake") || undefined,
  };

  // Final resolved params
  const usernameParam = qp.username || cx.username || tg.username || ls.username || "";
  const telegramIdParam = qp.telegramId || cx.telegramId || tg.telegramId || ls.telegramId || "";
  const roomId = qp.roomId || cx.roomId || ls.roomId || "";
  const stake = Number(qp.stake || cx.stake || ls.stake || 0);

  // Persist once resolved so future navigations don't break
  useEffect(() => {
    if (usernameParam) localStorage.setItem("username", usernameParam);
    if (telegramIdParam) localStorage.setItem("telegramId", telegramIdParam);
    if (roomId) localStorage.setItem("roomId", roomId);
    if (!Number.isNaN(stake)) localStorage.setItem("stake", String(stake));
  }, [usernameParam, telegramIdParam, roomId, stake]);

  const [searchParams] = useSearchParams();

  // --- States ---
  const [selectedCartelaIndex, setSelectedCartelaIndex] = useState(null); // Single selected cartela index
  const [pendingCartelaIndex, setPendingCartelaIndex] = useState(null); // Cartela waiting for backend confirmation
  const [finalSelectedCartelas, setFinalSelectedCartelas] = useState([]); // Accepted cartelas
  const [timer, setTimer] = useState(null);
  const [wallet, setWallet] = useState(0);
  const [activeGame, setActiveGame] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);

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
    if (!telegramIdParam) {
      console.warn("No telegramIdParam available to fetch wallet.");
      return 0;
    }
    try {
      console.log("Fetching wallet data for Telegram ID:", telegramIdParam);
      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/depositcheckB`,
        { telegramId: telegramIdParam }
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
    if (!roomId || !usernameParam || !telegramIdParam) {
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
          username: usernameParam,
          telegramId: telegramIdParam,
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
      if (state.timer != null) setTimer(state.timer);
      if (state.activeGame != null) setActiveGame(state.activeGame);
    };
    socket.on("currentGameState", handleGameState);

    return () => {
      socket.off("currentGameState", handleGameState);
    };
  }, [roomId, usernameParam, telegramIdParam, clientId, stake]);

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
      setPendingCartelaIndex(null);
      setFinalSelectedCartelas(prev => Array.from(new Set([...prev, cartelaIndex])));
      if (updatedWallet != null) setWallet(updatedWallet);
      setIsConfirming(false);
      toast.success(`Cartela ${cartelaIndex + 1} accepted!`);
    };
   
    const onCartelaError = ({ message }) => {
      toast.error(message || "Cartela selection error");
      setIsConfirming(false);
    };
   
    const onCountdown = (seconds) => setTimer(seconds);
   
    const onCountdownEnd = (cartelasFromServer) => {
      if (!cartelasFromServer || cartelasFromServer.length === 0) {
        toast.error("You did not select any cartela. Please select at least one.");
        return;
      }

      localStorage.setItem("myCartelas", JSON.stringify(cartelasFromServer));

      // --- Tell server this player is now in-game ---
      socket.emit("markPlayerInGame", {
        roomId,
        clientId
      });

      // --- Navigate to BingoBoard with state ---
      const queryString = new URLSearchParams({
        username: usernameParam,
        telegramId: telegramIdParam,
        roomId,
        stake
      }).toString();

      navigate(`/BingoBoard?${queryString}`, {
        state: {
          username: usernameParam,
          roomId,
          stake,
          myCartelas: cartelasFromServer,
          telegramId: telegramIdParam
        }
      });
    };

    const onUpdateSelectedCartelas = ({ selectedIndexes }) => {
      setFinalSelectedCartelas(prev => Array.from(new Set([...prev, ...selectedIndexes])));
    };
   
    const onActiveGameStatus = ({ activeGame }) => setActiveGame(activeGame);
   
    const onCartelaRejected = ({ message }) => {
      toast.error(message || "Cannot select this cartela");
      setPendingCartelaIndex(null);
      setIsConfirming(false);
    };
   
    const onRoomAvailable = () => {
      setActiveGame(false);
      setSelectedCartelaIndex(null);
      setPendingCartelaIndex(null);
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
  }, [navigate, roomId, usernameParam, stake, telegramIdParam]);

  useEffect(() => {
    if (!roomId || !clientId) return;

    // Ask server if this player is already in an active game
    socket.emit("checkPlayerStatus", { roomId, clientId });

    const handlePlayerStatus = ({ inGame, selectedCartelas }) => {
      if (inGame) {
        // Player is already in a game → navigate directly to BingoBoard
        const queryString = new URLSearchParams({
          username: usernameParam,
          telegramId: telegramIdParam,
          roomId,
          stake
        }).toString();

        navigate(`/BingoBoard?${queryString}`, {
          state: {
            username: usernameParam,
            roomId,
            stake,
            myCartelas: selectedCartelas,
            telegramId: telegramIdParam
          }
        });
      }
    };

    socket.on("playerStatus", handlePlayerStatus);

    return () => {
      socket.off("playerStatus", handlePlayerStatus);
    };
  }, [roomId, clientId, usernameParam, telegramIdParam, stake, navigate]);

  // --- Button Handlers ---
  const handleButtonClick = (index) => {
    if (activeGame) return toast.error("Game in progress – wait until it ends");
    if (finalSelectedCartelas.includes(index)) return;
    if (selectedCartelaIndex !== null) return toast.error("Please confirm your current selection first");
    if (pendingCartelaIndex !== null) return toast.error("Waiting for confirmation of previous selection");
   
    if (wallet < stake) {
      toast.error("Insufficient balance");
      return;
    }

    // limit max cartelas to 4
    if (finalSelectedCartelas.length >= 4) {
      toast.error("You can only select up to 4 cartelas");
      return;
    }

    setSelectedCartelaIndex(index);
  };

  const handleAddCartela = () => {
    if (activeGame) return toast.error("Cannot add cartela – game in progress");
    if (selectedCartelaIndex === null) return toast.error("Select a cartela first");
    if (wallet < stake) {
      toast.error("Insufficient balance for selected cartela");
      return;
    }

    setIsConfirming(true);
    setPendingCartelaIndex(selectedCartelaIndex);
    
    // Send to backend for confirmation
    socket.emit("selectCartela", { 
      roomId, 
      cartelaIndex: selectedCartelaIndex, 
      clientId 
    });
    
    setSelectedCartelaIndex(null);
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
          <div className="display-btn">Selected: {finalSelectedCartelas.length}/4</div>
        </div>
       
        {timer !== null && <div className="timer-display">Time Remaining: {timer}s</div>}
       
        <div className="Cartelacontainer">
          {cartela.map((_, index) => {
            const isTakenByOthers = finalSelectedCartelas.includes(index);
            const isSelected = selectedCartelaIndex === index;
            const isPending = pendingCartelaIndex === index;
            
            return (
              <button
                key={`cartela-btn-${index}`}
                onClick={() => handleButtonClick(index)}
                className="cartela"
                style={{
                  background: isTakenByOthers 
                    ? "red" 
                    : isPending 
                      ? "orange" 
                      : isSelected 
                        ? "yellow" 
                        : "#eeeeee",
                  color: isTakenByOthers || isPending || isSelected ? "white" : "black",
                  cursor: isTakenByOthers || activeGame || isPending ? "not-allowed" : "pointer",
                }}
                disabled={isTakenByOthers || activeGame || isPending || wallet < stake}
              >
                {index + 1}
              </button>
            );
          })}
        </div>
       
        {/* Only show the last selected cartela at the bottom */}
        {selectedCartelaIndex !== null && (
          <div className="selected-cartela-container">
            <h3>Selected Cartela (Click 'Add Cartela' to confirm):</h3>
            <div className="cartela-display selected">
              <div className="cartela-header">
                <span>Cartela {selectedCartelaIndex + 1}</span>
              </div>
              <div className="cartela-content">
                {cartela[selectedCartelaIndex].cart.map((row, rowIndex) => (
                  <div key={rowIndex} className="cartela-row">
                    {row.map((cell, cellIndex) => (
                      <span key={cellIndex} className="cartela-cell">
                        {cell}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Only show the pending cartela if there is one */}
        {pendingCartelaIndex !== null && (
          <div className="pending-cartela-container">
            <h3>Cartela Waiting for Confirmation:</h3>
            <div className="cartela-display pending">
              <div className="cartela-header">
                <span>Cartela {pendingCartelaIndex + 1}</span>
                <span className="pending-text">Pending Confirmation...</span>
              </div>
              <div className="cartela-content">
                {cartela[pendingCartelaIndex].cart.map((row, rowIndex) => (
                  <div key={rowIndex} className="cartela-row">
                    {row.map((cell, cellIndex) => (
                      <span key={cellIndex} className="cartela-cell">
                        {cell}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
       
        <div className="buttonconfirm">
          <button
            className="game_start"
            disabled={selectedCartelaIndex === null || activeGame || wallet < stake || isConfirming}
            onClick={handleAddCartela}
          >
            {isConfirming ? "Confirming..." : `Add Cartela - Cost: ${stake} ETB`}
          </button>
        </div>
      </div>
      <ToastContainer />
    </React.Fragment>
  );
}

export default CartelaSelction;