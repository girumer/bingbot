import React, { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import "./CartelaSelction.css";
import cartela from "./cartela.json";
import { useSearchParams, useNavigate } from "react-router-dom";
import socket from "../socket";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function CartelaSelction() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // --- Read query params ---
  const usernameParam = searchParams.get("username") ;
  const roomId = searchParams.get("roomId") ;
  const telegramIdParam = searchParams.get("telegramId");
  const stake = Number(searchParams.get("stake")) || 0;

  // --- States (MUST be at top, no conditions before them) ---
  const [selectedCartelas, setSelectedCartelas] = useState([]);
  const [finalSelectedCartelas, setFinalSelectedCartelas] = useState([]);
  const [timer, setTimer] = useState(null);
  const [wallet, setWallet] = useState(0);
  const [activeGame, setActiveGame] = useState(false);
  const [isReady, setIsReady] = useState(false);

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

  // --- Mark user as logged in (fixes redirect) ---
  useEffect(() => {
    localStorage.setItem("username", usernameParam);
    localStorage.setItem("isLoggedIn", "true");
    setIsReady(true);
  }, [usernameParam]);

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

  // --- Listen for roomAvailable ---
  useEffect(() => {
    const handleRoomAvailable = () => {
      setActiveGame(false);
      setSelectedCartelas([]);
      setFinalSelectedCartelas([]);
      setTimer(null);
    };
    socket.on("roomAvailable", handleRoomAvailable);
    return () => socket.off("roomAvailable", handleRoomAvailable);
  }, []);

  // --- Fetch wallet ---
 
 useEffect(() => {
    // Only fetch if telegramId is available
    if (!telegramIdParam) {
        console.error("Telegram ID is missing from URL. Cannot fetch wallet.");
        // You might want to navigate back to a safe page or show a generic error
        navigate("/", { replace: true });
        return;
    }

    const fetchWallet = async () => {
      try {
        const response = await axios.post(
          `${process.env.REACT_APP_BACKEND_URL}/depositcheckB`,
          // Use telegramId for a reliable lookup
          { telegramId: telegramIdParam } 
        );
        setWallet(Number(response.data));
      } catch (err) {
        console.error("Failed to fetch wallet:", err);
        // Display a user-friendly error
        toast.error("Failed to load user data. Please try again.");
        // Redirect to a safe page after an error
        setTimeout(() => navigate("/", { replace: true }), 3000); 
      }
    };
    fetchWallet();
  }, [telegramIdParam, navigate]); // Add telegramIdParam and navigate to dependency array

  // --- Join room & get current state ---
  useEffect(() => {
    socket.emit("joinRoom", { roomId, username: usernameParam, clientId, stake });

    const handleGameState = (state) => {
      setFinalSelectedCartelas(Array.from(new Set(state.selectedIndexes || [])));
      setSelectedCartelas((prev) =>
        prev.filter((idx) => !(state.selectedIndexes || []).includes(idx))
      );
      if (state.timer != null) setTimer(state.timer);
      if (state.activeGame != null) setActiveGame(state.activeGame);
    };

    socket.on("currentGameState", handleGameState);
    return () => socket.off("currentGameState", handleGameState);
  }, [roomId, usernameParam, clientId, stake]);

  // --- Socket events ---
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
        state: { username: usernameParam, roomId, stake, myCartelas: cartelasFromServer },
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

    socket.on("cartelaAccepted", onCartelaAccepted);
    socket.on("cartelaError", onCartelaError);
    socket.on("startCountdown", onCountdown);
    socket.on("myCartelas", onCountdownEnd);
    socket.on("updateSelectedCartelas", onUpdateSelectedCartelas);
    socket.on("activeGameStatus", onActiveGameStatus);

    return () => {
      socket.off("cartelaAccepted", onCartelaAccepted);
      socket.off("cartelaError", onCartelaError);
      socket.off("startCountdown", onCountdown);
      socket.off("myCartelas", onCountdownEnd);
      socket.off("updateSelectedCartelas", onUpdateSelectedCartelas);
      socket.off("activeGameStatus", onActiveGameStatus);
    };
  }, [navigate, roomId, usernameParam, stake]);

  // --- Cartela Rejected ---
  useEffect(() => {
    const onCartelaRejected = ({ message }) =>
      toast.error(message || "Cannot select this cartela");
    socket.on("cartelaRejected", onCartelaRejected);
    return () => socket.off("cartelaRejected", onCartelaRejected);
  }, []);

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

  const handleAddCartela = () => {
    if (activeGame) return toast.error("Cannot add cartela – game in progress");
    if (!selectedCartelas.length) return toast.error("Select at least one cartela first");

    selectedCartelas.forEach((idx) => {
      socket.emit("selectCartela", { roomId, cartelaIndex: idx, clientId });
    });
    setSelectedCartelas([]);
  };

  // --- Wait until ready ---
  if (!isReady) return <div>Loading...</div>;

  return (
    <React.Fragment>
      <Navbar />
      <div className="Cartelacontainer-wrapper">
        <div className="wallet-stake-display">
          <div className="display-btn">Wallet: {wallet}</div>
          <div className="display-btn">Active Game: {activeGame ? 1 : 0}</div>
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
