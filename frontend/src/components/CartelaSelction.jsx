import React, { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import "./CartelaSelction.css";
import cartela from "./cartela.json";
import { useLocation, useNavigate } from "react-router-dom";
import { useSearchParams } from "react-router-dom";
import socket from "../socket";
import axios from "axios";

import { toast,ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function CartelaSelction() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const username = location.state?.username || "Guest";
  const roomId = String(location.state?.roomId || "default");
  //const stake = Number(location.state?.stake ?? location.state?.roomId);
const stake = Number(searchParams.get("stake")) || Number(roomId);
  const [selectedCartelas, setSelectedCartelas] = useState([]); // currently pending
  const [finalSelectedCartelas, setFinalSelectedCartelas] = useState([]); // already accepted
  const [timer, setTimer] = useState(null);
  const [wallet, setWallet] = useState(0); 
  const [activeGame, setActiveGame] = useState(false);

  const getClientId = () => {
    let cid = localStorage.getItem("clientId");
    if (!cid) {
      cid = `${Date.now()}-${Math.random()}`;
      localStorage.setItem("clientId", cid);
    }
    return cid;
  };
  const clientId = getClientId();
useEffect(() => {
  const handleRoomAvailable = () => {
    // Reset local state so players can join again
    setActiveGame(false);
    setSelectedCartelas([]);
    setFinalSelectedCartelas([]);
    setTimer(null);
  };

  socket.on("roomAvailable", handleRoomAvailable);

  return () => socket.off("roomAvailable", handleRoomAvailable);
}, []);

  // Fetch wallet
  useEffect(() => {
    const fetchWallet = async () => {
      try {
        const response = await axios.post(
          `${process.env.REACT_APP_BACKEND_URL}/depositcheckB`,
          { username }
        );
        setWallet(Number(response.data));
      } catch (err) {
        console.error("Failed to fetch wallet:", err);
      }
    };
    fetchWallet();
  }, [username]);

  // Join room & get current state
  useEffect(() => {
    socket.emit("joinRoom", { roomId, username, clientId, stake });

    const handleGameState = (state) => {
      setFinalSelectedCartelas(Array.from(new Set(state.selectedIndexes || [])));
      setSelectedCartelas(prev =>
        prev.filter(idx => !(state.selectedIndexes || []).includes(idx))
      );
      if (state.timer != null) setTimer(state.timer);
      if (state.activeGame != null) setActiveGame(state.activeGame);
    };

    socket.on("currentGameState", handleGameState);
    return () => socket.off("currentGameState", handleGameState);
  }, [roomId, username, clientId, stake]);

  // Socket events
  useEffect(() => {
    const onCartelaAccepted = ({ cartelaIndex, Wallet: updatedWallet }) => {
      // Remove from pending
      setSelectedCartelas(prev => prev.filter(idx => idx !== cartelaIndex));
      // Add to final
      setFinalSelectedCartelas(prev => Array.from(new Set([...prev, cartelaIndex])));
      if (updatedWallet != null) setWallet(updatedWallet);
    };

    const onCartelaError = ({ message }) => {
       toast.error(message || "Cartela selection error");
    };

    const onCountdown = (seconds) => setTimer(seconds);
   const onCountdownEnd = (cartelasFromServer) => {
  if (!cartelasFromServer || cartelasFromServer.length === 0) {
  toast.error("You did not select any cartela. Please select at least one.");

    return; // do NOT navigate
  }

  localStorage.setItem("myCartelas", JSON.stringify(cartelasFromServer));
  navigate("/BingoBoard", {
    state: { username, roomId, stake, myCartelas: cartelasFromServer },
  });
};

    const onUpdateSelectedCartelas = ({ selectedIndexes }) => {
      setFinalSelectedCartelas(prev => Array.from(new Set([...prev, ...selectedIndexes])));
      setSelectedCartelas(prev => prev.filter(idx => !selectedIndexes.includes(idx)));
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
  }, [navigate, roomId, username, stake]);

  // --- Handle selection ---

const handleButtonClick = (index) => {
  if (activeGame) return toast.error("Game in progress – wait until it ends");
  if (finalSelectedCartelas.includes(index)) return;

  setSelectedCartelas(prev => {
    // Deselect if already selected
    if (prev.includes(index)) return prev.filter(i => i !== index);

    // Local limit: prevent selecting more than 4 pending
    if (prev.length >= 4) {
      toast.error("You can only select up to 4 cartelas");
      return prev; // do not add
    }

    return [...prev, index]; // add new selection
  });
};

const handleAddCartela = () => {
  if (activeGame) return toast.error("Cannot add cartela – game in progress");
  if (!selectedCartelas.length) return toast.error("Select at least one cartela first");

  selectedCartelas.forEach(idx => {
    socket.emit("selectCartela", { roomId, cartelaIndex: idx, clientId });
  });

  setSelectedCartelas([]); // clear local pending
};

// --- Listen for server rejection (4-cartela limit, wallet, etc.) ---
useEffect(() => {
  const onCartelaRejected = ({ message }) => {
    toast.error(message || "You cannot select this cartela");
  };

  socket.on("cartelaRejected", onCartelaRejected);

  return () => socket.off("cartelaRejected", onCartelaRejected);
}, []);




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
                  cursor: isTakenByOthers  || activeGame ? "not-allowed" : "pointer",
                }}
                disabled={isTakenByOthers  || activeGame}
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
                      <span key={cellIndex} className="cartela-cell1">{cell}</span>
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
            disabled={!selectedCartelas.length }
            onClick={handleAddCartela}
          >
            Add Cartela(s)
          </button>
        </div>
      </div>
    </React.Fragment>
  );
}

export default CartelaSelction;
