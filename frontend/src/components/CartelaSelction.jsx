import React, { useState, useEffect } from "react";

import Navbar from "../components/Navbar";

import "./CartelaSelction.css";
import { motion } from "framer-motion";
import cartela from "./cartela.json";

import { useNavigate, useSearchParams,useOutletContext } from "react-router-dom";

import socket from "../socket";

import axios from "axios";

import { toast, ToastContainer } from "react-toastify";

import "react-toastify/dist/ReactToastify.css";



function CartelaSelction() {

 const navigate = useNavigate();



// Try to read from Outlet context if you still use it elsewhere

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



// Persist once resolved so future navigations don’t break

useEffect(() => {

  if (usernameParam) localStorage.setItem("username", usernameParam);

  if (telegramIdParam) localStorage.setItem("telegramId", telegramIdParam);

  if (roomId) localStorage.setItem("roomId", roomId);

  if (!Number.isNaN(stake)) localStorage.setItem("stake", String(stake));

}, [usernameParam, telegramIdParam, roomId, stake]);



  const [searchParams] = useSearchParams();

 

  // Get parameters from URL



 

  // Use these parameters for your component's logic

 

 

  // --- States ---

  const [selectedCartelas, setSelectedCartelas] = useState([]);

  const [finalSelectedCartelas, setFinalSelectedCartelas] = useState([]);

  const [timer, setTimer] = useState(null);

  const [wallet, setWallet] = useState(0);

  const [activeGame, setActiveGame] = useState(false);

  const [isLoading, setIsLoading] = useState(true);

 // Currently selected by this user (not confirmed)
const [myConfirmedCartelas, setMyConfirmedCartelas] = useState([]); // Confirmed cartelas for THIS user
const [otherUsersCartelas, setOtherUsersCartelas] = useState([]); // Cartelas selected by OTHER users

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

        { telegramId: telegramIdParam}

   

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


useEffect(() => {
  if (socket.disconnected) {
    socket.connect(); // Reconnect if disconnected
  }
}, []);

useEffect(() => {
  if (myConfirmedCartelas.length > 0) {
    localStorage.setItem("myConfirmedCartelas", JSON.stringify(myConfirmedCartelas));
  }
}, [myConfirmedCartelas]);
// Restore confirmed cartelas from localStorage after refresh
useEffect(() => {
  const savedCartelas = localStorage.getItem("myConfirmedCartelas");
  if (savedCartelas) {
    setMyConfirmedCartelas(JSON.parse(savedCartelas));
  }
}, []);

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
  if (state.timer != null) setTimer(state.timer);
  if (state.activeGame != null) setActiveGame(state.activeGame);
  
  // Directly use myCartelas from the server to set myConfirmedCartelas
  setMyConfirmedCartelas(state.myCartelas || []);
  
  // ✅ NEW LOGIC: Only show other users' cartelas if a game is NOT active
  if (state.activeGame) {
    setOtherUsersCartelas([]);
  } else {
    // Calculate other users' cartelas by filtering out my own from the full list
    const otherCartelas = (state.selectedIndexes || []).filter(
      (index) => !state.myCartelas.includes(index)
    );
    setOtherUsersCartelas(otherCartelas);
  }
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
  setSelectedCartelas((prev) => prev.filter((idx) => idx !== cartelaIndex));
  setMyConfirmedCartelas((prev) =>
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
  // ✅ NEW LOGIC: Only show other users' cartelas if the game is NOT active
  if (activeGame) {
    setOtherUsersCartelas([]);
  } else {
    // Filter the full list of selected cartelas to find what other users have
    const newOtherCartelas = selectedIndexes.filter(
      (index) => !myConfirmedCartelas.includes(index)
    );
    // Update the state
    setOtherUsersCartelas(newOtherCartelas);
  }
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
  
  // Check if user has enough balance
  if (wallet < stake) {
    toast.error("Insufficient balance to select cartela");
    return;
  }

  // PREVENT MULTIPLE SELECTION - Only allow one cartela at a time
  if (selectedCartelas.length > 0) {
    toast.error("Please confirm your current selection first");
    return;
  }

  // limit max cartelas to 4
  if (selectedCartelas.length >= 4) {
    toast.error("You can only select up to 4 cartelas");
    return;
  }

  setSelectedCartelas([index]); // Only set one cartela at a time
};

 
const  handleremoveCartela=()=>{
  setSelectedCartelas([]);
}
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


const refreshpg = () => {
    // This command will reload the entire page from the server
    window.location.reload();
};
  // --- Render based on loading state ---

  if (isLoading) {

    

      return null;
    

  }



  return (

    <React.Fragment>

      <div className="Cartelacontainer-wrapper">

        <div className="wallet-stake-display">

          <div className="display-btn">Wallet: {wallet} ETB</div>

          <div className="display-btn">Active Game: {activeGame ? "1" : "0"}</div>

          <div className="display-btn">Stake: {stake} ETB</div>
         
        
      
        </div>

       

 {activeGame ? (
   <div className="timer-display">
  Game started – please wait…
</div>
) : (
 timer !== null && 
  <div className="timer-display">
     {Math.floor(timer / 60)}:{String(timer % 60).padStart(2, "0")}
  </div>
)}


 <div className="Cartelacontainer">

{cartela.map((_, index) => {
  const isSelectedByMe = selectedCartelas.includes(index) || myConfirmedCartelas.includes(index);
  const isSelectedByOthers = otherUsersCartelas.includes(index);
  
  return (
    <button
      key={`cartela-btn-${index}`}
      onClick={() => handleButtonClick(index)}
      className="cartela"
      style={{
        background: isSelectedByOthers ? "red" : isSelectedByMe ? "green" : "#ffb46494",
        color: isSelectedByOthers || isSelectedByMe ? "white" : "black",
        cursor: isSelectedByOthers || activeGame ? "not-allowed" : "pointer",
      }}
      disabled={isSelectedByOthers || activeGame || wallet < stake}
    >
      {index + 1}
    </button>
  );
})}

</div>



{selectedCartelas.length > 0 && (
  <div className="pending-cartelas">
    {/* Only show the last selected cartela */}
    <div key={`pending-${selectedCartelas[selectedCartelas.length - 1]}`} className="cartela-display1 pending">
      {cartela[selectedCartelas[selectedCartelas.length - 1]].cart.map((row, rowIndex) => (
        <div key={rowIndex} className="cartela-row1">
          {row.map((cell, cellIndex) => (
            <span key={cellIndex} className="cartela-cell1">
              {cell}
            </span>
          ))}
        </div>
      ))}
    </div>
  </div>
)}


 <div className="buttonconfirm">
<button

 className="game_start1"

 disabled={!selectedCartelas.length || activeGame || wallet < stake * selectedCartelas.length}

onClick={handleremoveCartela}

 >

 Cancel

</button>
<button

 className="game_start"

 disabled={!selectedCartelas.length || activeGame || wallet < stake * selectedCartelas.length}

onClick={handleAddCartela}

 >

 confirm

</button>

 </div>

</div>

<ToastContainer />

 </React.Fragment>

 );

}



export default CartelaSelction;