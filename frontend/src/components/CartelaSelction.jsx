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

  // --- Resolve Parameters ---
  const search = new URLSearchParams(window.location.search);
  const qp = {
    username: search.get("username"),
    telegramId: search.get("telegramId"),
    roomId: search.get("roomId"),
    stake: search.get("stake"),
  };
  const cx = {
    username: ctx.usernameFromUrl,
    telegramId: ctx.telegramIdFromUrl,
    roomId: ctx.roomIdFromUrl,
    stake: ctx.stakeFromUrl,
  };
  const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
  const tg = {
    username: tgUser?.username,
    telegramId: tgUser?.id ? String(tgUser.id) : undefined,
  };
  const ls = {
    username: localStorage.getItem("username"),
    telegramId: localStorage.getItem("telegramId"),
    roomId: localStorage.getItem("roomId"),
    stake: localStorage.getItem("stake"),
  };

  const usernameParam = qp.username || cx.username || tg.username || ls.username || "";
  const telegramIdParam = qp.telegramId || cx.telegramId || tg.telegramId || ls.telegramId || "";
  const roomId = qp.roomId || cx.roomId || ls.roomId || "";
  const stake = Number(qp.stake || cx.stake || ls.stake || 0);

  useEffect(() => {
    if (usernameParam) localStorage.setItem("username", usernameParam);
    if (telegramIdParam) localStorage.setItem("telegramId", telegramIdParam);
    if (roomId) localStorage.setItem("roomId", roomId);
    if (!Number.isNaN(stake)) localStorage.setItem("stake", String(stake));
  }, [usernameParam, telegramIdParam, roomId, stake]);

  // --- States ---
  const [selectedCartelas, setSelectedCartelas] = useState([]); // ✅ fixed
  const [finalSelectedCartelas, setFinalSelectedCartelas] = useState([]);
  const [timer, setTimer] = useState(null);
  const [wallet, setWallet] = useState(0);
  const [activeGame, setActiveGame] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // --- Client ID ---
  const getClientId = () => {
    let cid = localStorage.getItem("clientId");
    if (!cid) {
      cid = `${Date.now()}-${Math.random()}`;
      localStorage.setItem("clientId", cid);
    }
    return cid;
  };
  const clientId = getClientId();

  // --- Fetch Wallet ---
  const fetchWalletData = async () => {
    if (!telegramIdParam) return 0;
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/depositcheckB`,
        { telegramId: telegramIdParam }
      );
      let walletValue = 0;
      if (typeof response.data === "object" && response.data !== null) {
        walletValue = response.data.wallet || response.data.balance || 0;
      } else if (!isNaN(response.data)) {
        walletValue = Number(response.data);
      }
      setWallet(walletValue);
      return walletValue;
    } catch (err) {
      toast.error("Failed to load wallet data.");
      return 0;
    }
  };

  // --- Initialize Game ---
  useEffect(() => {
    if (!roomId || !usernameParam || !telegramIdParam) {
      setIsLoading(false);
      return;
    }

    const initializeGame = async () => {
      try {
        await fetchWalletData();
        socket.emit("joinRoom", { roomId, username: usernameParam, telegramId: telegramIdParam, clientId });
      } catch (err) {
        toast.error("Failed to initialize game. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };
    initializeGame();

    const handleGameState = (state) => {
      setFinalSelectedCartelas(Array.from(new Set(state.selectedIndexes || [])));
      setSelectedCartelas((prev) => prev.filter((idx) => !(state.selectedIndexes || []).includes(idx)));
      if (state.timer != null) setTimer(state.timer);
      if (state.activeGame != null) setActiveGame(state.activeGame);
    };
    socket.on("currentGameState", handleGameState);
    return () => socket.off("currentGameState", handleGameState);
  }, [roomId, usernameParam, telegramIdParam, clientId]);

  // --- Wallet Updates ---
  useEffect(() => {
    const handleWalletUpdate = ({ wallet: updatedWallet }) => {
      if (updatedWallet != null) setWallet(updatedWallet);
    };
    socket.on("walletUpdate", handleWalletUpdate);
    return () => socket.off("walletUpdate", handleWalletUpdate);
  }, []);

  // --- Socket Event Listeners ---
  useEffect(() => {
    const onCartelaAccepted = ({ cartelaIndex, Wallet: updatedWallet }) => {
      setSelectedCartelas((prev) => prev.filter((idx) => idx !== cartelaIndex));
      setFinalSelectedCartelas((prev) => Array.from(new Set([...prev, cartelaIndex])));
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
      socket.emit("markPlayerInGame", { roomId, clientId });

      const queryString = new URLSearchParams({ username: usernameParam, telegramId: telegramIdParam, roomId, stake }).toString();
      navigate(`/BingoBoard?${queryString}`, {
        state: { username: usernameParam, roomId, stake, myCartelas: cartelasFromServer, telegramId: telegramIdParam }
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

  // --- Check Player Status ---
  useEffect(() => {
    if (!roomId || !clientId) return;
    socket.emit("checkPlayerStatus", { roomId, clientId });

    const handlePlayerStatus = ({ inGame, selectedCartelas }) => {
      if (inGame) {
        const queryString = new URLSearchParams({ username: usernameParam, telegramId: telegramIdParam, roomId, stake }).toString();
        navigate(`/BingoBoard?${queryString}`, {
          state: { username: usernameParam, roomId, stake, myCartelas: selectedCartelas, telegramId: telegramIdParam }
        });
      }
    };

    socket.on("playerStatus", handlePlayerStatus);
    return () => socket.off("playerStatus", handlePlayerStatus);
  }, [roomId, clientId, usernameParam, telegramIdParam, stake, navigate]);

  // --- Handlers ---
  const handleButtonClick = (index) => {
    if (activeGame) return toast.error("Game in progress – wait until it ends");
    if (finalSelectedCartelas.includes(index)) return;
    if (wallet < stake) return toast.error("Insufficient balance");
    if (finalSelectedCartelas.length >= 4) return toast.error("You can only select up to 4 cartelas");

    socket.emit("selectCartela", { roomId, cartelaIndex: index, clientId });
  };

  const handleAddCartela = () => toast.info("Just click a cartela to send it. You don’t need this button anymore.");

  // --- Render ---
  if (isLoading) return <div className="flex items-center justify-center min-h-screen text-lg">Loading...</div>;

  return (
    <>
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
                key={index}
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
                      <span key={cellIndex} className="cartela-cell1">{cell}</span>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        <div className="buttonconfirm">
          <button className="game_start" disabled={activeGame || wallet < stake} onClick={handleAddCartela}>
            Confirm
          </button>
        </div>
      </div>
      <ToastContainer />
    </>
  );
}

export default CartelaSelction;
