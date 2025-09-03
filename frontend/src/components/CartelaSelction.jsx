import React, { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import "./CartelaSelction.css";
import cartela from "./cartela.json";
import { useNavigate, useOutletContext } from "react-router-dom";
import socket from "../socket";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function CartelaSelction() {
    const navigate = useNavigate();

    // Get all parameters from the context provided by ProtectedRoute
    const { 
        usernameFromUrl, 
        telegramIdFromUrl,
        roomIdFromUrl, 
        stakeFromUrl,
        clientIdFromUrl // Get clientId from the URL
    } = useOutletContext();

    // Use these context values for your component's logic
    const usernameParam = usernameFromUrl;
    const telegramIdParam = telegramIdFromUrl;
    const roomId = roomIdFromUrl; 
    const stake = Number(stakeFromUrl) || 0; 
    const clientId = clientIdFromUrl; // Use clientId from URL

    // --- States ---
    const [selectedCartelas, setSelectedCartelas] = useState([]);
    const [finalSelectedCartelas, setFinalSelectedCartelas] = useState([]);
    const [timer, setTimer] = useState(null);
    const [wallet, setWallet] = useState(0);
    const [activeGame, setActiveGame] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // --- Telegram WebApp ready check ---
    useEffect(() => {
        if (window.Telegram?.WebApp) {
            const tg = window.Telegram.WebApp;
            tg.ready();
        }
    }, []);

    // --- MAIN INITIALIZATION EFFECT ---
    useEffect(() => {
        // This check will now succeed because the data is provided via context
        if (!roomId || !usernameParam || !telegramIdParam || !clientId) {
            console.log("Frontend: Waiting for all required URL parameters...");
            setIsLoading(false); // Set to false to avoid infinite loading
            return;
        }

        const initializeGame = async () => {
            try {
                console.log("Frontend: Sending request for wallet balance with Telegram ID:", telegramIdParam);
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
                    console.error("Frontend: Unexpected response format:", response.data);
                    walletValue = 0;
                }
                setWallet(walletValue);
                setIsLoading(false);
            } catch (err) {
                console.error("Frontend: Failed to initialize. Error:", err.response ? err.response.data : err.message);
                toast.error("Failed to load user data. Please try again.");
                setIsLoading(false);
            }
        };
        
        initializeGame();
    }, [roomId, usernameParam, telegramIdParam, clientId, stake]);

    // --- Socket Connection Listener ---
    useEffect(() => {
        const handleSocketConnect = () => {
            // Ensure we have all necessary data before joining the room
            if (socket.connected && roomId && usernameParam && telegramIdParam && clientId) {
                console.log("Frontend: Socket connected. Emitting joinRoom event.");
                socket.emit("joinRoom", {
                    roomId,
                    username: usernameParam,
                    telegramId: telegramIdParam,
                    clientId,
                });
            }
        };

        // Only listen if the socket is not already connected.
        if (!socket.connected) {
            socket.on("connect", handleSocketConnect);
        } else {
            // If already connected, run the handler immediately.
            handleSocketConnect();
        }

        return () => {
            socket.off("connect", handleSocketConnect);
        };
    }, [roomId, usernameParam, telegramIdParam, clientId]);

    // --- Other Socket event listeners (correct and unchanged) ---
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

    // --- Button Handlers (correct and unchanged) ---
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
