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
    username: tgUser?.username || undefined,
    telegramId: tgUser?.id ? String(tgUser.id) : undefined,
  };

  const ls = {
    username: localStorage.getItem("username") || undefined,
    telegramId: localStorage.getItem("telegramId") || undefined,
    roomId: localStorage.getItem("roomId") || undefined,
    stake: localStorage.getItem("stake") || undefined,
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

  const [finalSelectedCartelas, setFinalSelectedCartelas] = useState([]); // confirmed cartelas
  const [pendingCartela, setPendingCartela] = useState(null); // current selection
  const [timer, setTimer] = useState(null);
  const [wallet, setWallet] = useState(0);
  const [activeGame, setActiveGame] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const getClientId = () => {
    let cid = localStorage.getItem("clientId");
    if (!cid) {
      cid = `${Date.now()}-${Math.random()}`;
      localStorage.setItem("clientId", cid);
    }
    return cid;
  };
  const clientId = getClientId();

  const fetchWalletData = async () => {
    if (!telegramIdParam) return 0;
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/depositcheckB`,
        { telegramId: telegramIdParam }
      );
      let walletValue = response.data?.wallet || response.data?.balance || 0;
      setWallet(walletValue);
      return walletValue;
    } catch (err) {
      toast.error("Failed to load wallet data.");
      return 0;
    }
  };

  useEffect(() => {
    if (!roomId || !usernameParam || !telegramIdParam) {
      setIsLoading(false);
      return;
    }

    const initializeGame = async () => {
      await fetchWalletData();
      socket.emit("joinRoom", { roomId, username: usernameParam, telegramId: telegramIdParam, clientId });
      setIsLoading(false);
    };

    initializeGame();

    const handleGameState = (state) => {
      setFinalSelectedCartelas(state.selectedIndexes || []);
      setTimer(state.timer || null);
      setActiveGame(state.activeGame || false);
    };

    socket.on("currentGameState", handleGameState);
    return () => socket.off("currentGameState", handleGameState);
  }, [roomId, usernameParam, telegramIdParam, clientId]);

  // --- Handle wallet updates ---
  useEffect(() => {
    const handleWalletUpdate = ({ wallet: updatedWallet }) => {
      if (updatedWallet !== undefined) setWallet(updatedWallet);
    };
    socket.on("walletUpdate", handleWalletUpdate);
    return () => socket.off("walletUpdate", handleWalletUpdate);
  }, []);

  // --- Handle cartela events ---
  useEffect(() => {
    const onCartelaAccepted = ({ cartelaIndex, Wallet: updatedWallet }) => {
      setFinalSelectedCartelas((prev) => [...prev, cartelaIndex]);
      setPendingCartela(null); // clear current selection
      if (updatedWallet != null) setWallet(updatedWallet);
    };

    const onCartelaError = ({ message }) => toast.error(message || "Cartela selection error");
    const onCountdown = (seconds) => setTimer(seconds);
    const onCountdownEnd = (cartelasFromServer) => {
      localStorage.setItem("myCartelas", JSON.stringify(cartelasFromServer));
      socket.emit("markPlayerInGame", { roomId, clientId });
      const queryString = new URLSearchParams({ username: usernameParam, telegramId: telegramIdParam, roomId, stake }).toString();
      navigate(`/BingoBoard?${queryString}`, { state: { username: usernameParam, roomId, stake, myCartelas: cartelasFromServer, telegramId: telegramIdParam } });
    };

    socket.on("cartelaAccepted", onCartelaAccepted);
    socket.on("cartelaError", onCartelaError);
    socket.on("startCountdown", onCountdown);
    socket.on("myCartelas", onCountdownEnd);

    return () => {
      socket.off("cartelaAccepted", onCartelaAccepted);
      socket.off("cartelaError", onCartelaError);
      socket.off("startCountdown", onCountdown);
      socket.off("myCartelas", onCountdownEnd);
    };
  }, [navigate, roomId, usernameParam, telegramIdParam, stake, clientId]);

  // --- Button handler for selecting a cartela ---
  const handleButtonClick = (index) => {
    if (activeGame) return toast.error("Game in progress – wait until it ends");
    if (finalSelectedCartelas.includes(index)) return toast.error("Already selected by someone");
    if (pendingCartela === index) return; // already pending
    if (wallet < stake) return toast.error("Insufficient balance");
    if (finalSelectedCartelas.length >= 4) return toast.error("You can only select up to 4 cartelas total");

    // Set as pending
    setPendingCartela(index);

    // Send selection to server
    socket.emit("selectCartela", { roomId, cartelaIndex: index, clientId });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen text-lg">Loading...</div>;
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
            const isPending = pendingCartela === index;
            return (
              <button
                key={index}
                onClick={() => handleButtonClick(index)}
                className="cartela"
                style={{
                  background: isTakenByOthers ? "red" : isPending ? "yellow" : "#eeeeee",
                  color: isTakenByOthers || isPending ? "white" : "black",
                  cursor: isTakenByOthers || activeGame ? "not-allowed" : "pointer",
                }}
                disabled={isTakenByOthers || activeGame || wallet < stake}
              >
                {index + 1}
              </button>
            );
          })}
        </div>

        {pendingCartela !== null && (
          <div className="pending-cartelas">
            <div className="cartela-display1 pending">
              {cartela[pendingCartela].cart.map((row, rowIndex) => (
                <div key={rowIndex} className="cartela-row1">
                  {row.map((cell, cellIndex) => (
                    <span key={cellIndex} className="cartela-cell1">{cell}</span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <ToastContainer />
    </React.Fragment>
  );
}

export default CartelaSelction;
