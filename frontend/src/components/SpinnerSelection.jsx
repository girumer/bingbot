import React, { useState, useEffect,useMemo , useRef } from "react";
import {  useNavigate, useSearchParams,useOutletContext } from "react-router-dom";
import axios from "axios";

import { toast, ToastContainer } from "react-toastify";

import socket from "../socket";

const SpinnerSelection = () => {
  const [searchParams] = useSearchParams();
  const [selectedNumbers, setSelectedNumbers] = useState([]);
  const stakeValue=5;
    const [wallet, setWallet] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
 // State to control wheel rotation
const segmentThemes = [
  // Value 0 is the lowest prize/loss
  { value: 0, theme: 'Cabbage', color: '#6AA84F', icon: '🥬' }, // Cabbage (Green)
  { value: 5, theme: 'Lemon', color: '#FFD966', icon: '🍋' }, // Lemon (Yellow)
  { value: 7, theme: 'Orange', color: '#FFA500', icon: '🍊' }, // Orange (Orange)
  { value: 10, theme: 'Apple', color: '#CC0000', icon: '🍎' }, // Apple (Red)
  { value: 12, theme: 'Papaya', color: '#FF6347', icon: '🍈' }, // Papaya (Tomato Red)
  { value: 15, theme: 'Cinnamon', color: '#D2691E', icon: '🌰' }, // Cinnamon (Brown)
  { value: 20, theme: 'Banana', color: '#FFE599', icon: '🍌' }, // Banana (Light Yellow)
  { value: 25, theme: 'Pineapple', color: '#FFD700', icon: '🍍' }, // Pineapple (Gold)
  { value: 30, theme: 'Mango', color: '#F6B26B', icon: '🥭' }, // Mango (Orange)
  { value: 50, theme: 'Bonus', color: '#4A86E8', icon: '✨' }, // Bonus (Blue)
];
const ctx = useOutletContext() || {};
const search = new URLSearchParams(window.location.search);
const qp = {

 username: search.get("username"),

telegramId: search.get("telegramId"),

 

 stake: search.get("stake"),

};
const cx = {

 username: ctx.usernameFromUrl,

 telegramId: ctx.telegramIdFromUrl,



 stake: ctx.stakeFromUrl,

};
const ls = {

 username: localStorage.getItem("username") || undefined,

 telegramId: localStorage.getItem("telegramId") || undefined,

 

 stake: localStorage.getItem("stake") || undefined,

};
const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
const tg = {

 username: tgUser?.username || undefined,

 telegramId: tgUser?.id ? String(tgUser.id) : undefined,

};
const usernameParam = qp.username || cx.username || tg.username || ls.username || "";

const telegramIdParam = qp.telegramId || cx.telegramId || tg.telegramId || ls.telegramId || "";

const numbers = segmentThemes.map(t => t.value);
const segmentCount = numbers.length;
const segmentAngle = 360 / segmentCount; // 60 degrees

// These probabilities make the 50 point segment much rarer (5%)
const probabilities = {
  50: 1, // 5% chance
  30: 1, // 10% chance
  25:1,
  20: 1, // 20% chance
  15:2,
  12:2,
  10: 5, // 20% chance
  7:7,
  5: 20, // 25% chance
  0: 60, // 20% chance
};

  const username = searchParams.get("username");
  const telegramId = searchParams.get("telegramId");
  const stake = searchParams.get("stake");
  const navigate = useNavigate();

  // Spinner values from your ORIGINAL code: 200, 150, 100, 50, 5, "Sad"
  
 const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const wheelRef = useRef(null);
  const conicGradient = useMemo(() => {
    const stops = segmentThemes.map((theme, index) => {
      const start = index * segmentAngle;
      const end = (index + 1) * segmentAngle;
      return `${theme.color} ${start}deg ${end}deg`;
    }).join(', ');
    return `conic-gradient(${stops})`;
  }, []);
  const getWeightedRandomNumber = () => {
    const random = Math.random() * 100;
    let cumulative = 0;
    for (const number of numbers) {
      cumulative += probabilities[number];
      if (random <= cumulative) return number;
    }
    // Fallback in case of rounding errors, should return the highest probability item (e.g., 5)
    return numbers.sort((a, b) => probabilities[b] - probabilities[a])[0];
  };

  // Function to get result message based on the result value
  const getResultMessage = (resultValue) => {
    if (resultValue === 0) {
      return "💔 You lost! Better luck next time! 💔";
    } else if (resultValue === 5) {
      return "😐 No win, try again! 😐";
    } else {
      return `🎉 You won: ${resultValue}! 🎉`;
    }
  };

  const spinWheel  = async () => {
   if (spinning || wallet < stakeValue) {
        if (wallet < stakeValue) {
            toast.error(`Insufficient balance! You need ${stakeValue} to spin.`);
        }
        return;
    }
    setSpinning(true);
    setResult(null);
const deduction = -stakeValue;
   // const newWalletAfterDeduction = await updateWallet(deduction);
    setWallet(prev => prev + deduction);
    await updateWallet(deduction);
    const winningNumber = getWeightedRandomNumber();
    const segmentIndex = numbers.indexOf(winningNumber);

    // Calculate the angle to the CENTER of the winning segment
    const centerAngleOfWinningSegment = segmentIndex * segmentAngle + (segmentAngle / 2);
  console.log("center",centerAngleOfWinningSegment);
    // The wheel rotates CLOCKWISE. We want the center of the winning segment 
    // to stop at the pointer (which is at the top, or 0 degrees).
    // Rotation required: 360 - center angle
    const segmentTargetRotation = 360 - (centerAngleOfWinningSegment+36);
   console.log("segment is ",segmentTargetRotation);
    // Add full spins (5-9 spins) for a smooth, exciting animation
    const spins = 5 + Math.floor(Math.random() * 5);
    const targetRotation = (spins * 360) + segmentTargetRotation;

    if (wheelRef.current) {
      // Apply transition for the spin duration
      wheelRef.current.style.transition = 'transform 4s cubic-bezier(0.2, 0.8, 0.3, 1)';
      wheelRef.current.style.transform = `rotate(${targetRotation}deg)`;
    }

    // Set result after the spin animation completes
   setTimeout(async () => {
      setSpinning(false);
      setResult(winningNumber);
      const winAmount = winningNumber;

      if (winAmount > 0) {
       // showToast(`🥳 You won ${winAmount} ETB!`, 'success');
        // Update wallet with the win amount
        await updateWallet(winAmount);
      } else {
        // If winAmount is 0 (or 5), the stake was already recorded as a net loss.
       // showToast(getResultMessage(winningNumber), winAmount === 0 ? 'error' : 'info');
        // No further wallet update needed for a net loss/break-even
      }
    }, 4000);
  };

  const resetWheel = () => {
    if (wheelRef.current) {
      // Reset transform immediately without transition
      wheelRef.current.style.transition = 'none';
      wheelRef.current.style.transform = 'rotate(0deg)';
    }
    setResult(null);
    setSpinning(false);
  };
  useEffect(() => {
    if (window.Telegram && window.Telegram.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
      console.log("Telegram WebApp initialized");
    }

    if (username && telegramId && stake) {
      const clientId = `${telegramId}-spinner`;
      socket.emit("joinSpinnerRoom", {
       
        username,
        telegramId,
        clientId,
      });
    }
  }, [username, telegramId, stake]);

 

// Restore confirmed cartelas from localStorage after refresh

 const fetchWalletData = async () => {

 if (!telegramIdParam) {

 console.warn("No telegramIdParam available to fetch wallet.");

 return 0;

}

 try {

 console.log("Fetching wallet data for Telegram ID is:", telegramIdParam);

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

 return 0; }

 };
useEffect(() => {
  const init = async () => {
    if (!usernameParam || !telegramIdParam) {
      console.log("Waiting for all required URL parameters...");
      setIsLoading(false);
      return;
    }

    try {
      // Fetch wallet data
      await fetchWalletData();
      // Join the game room (if needed)
    } catch (err) {
      console.error("Failed to initialize:", err);
      toast.error("Failed to initialize game. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  init();
}, [ usernameParam, telegramIdParam,  stake]);


  const updateWallet = async (amount) => {
    if (!telegramIdParam) return;

    try {
        const response = await axios.post(
            `${process.env.REACT_APP_BACKEND_URL}/update-wallet`, // **CHANGE THIS URL to your actual endpoint**
            { 
                telegramId: telegramIdParam, 
                amount: amount // Positive for win, negative for loss/stake
            }
        );
        // Assuming your backend returns the new balance
        const newBalance = response.data.wallet || response.data.balance || 0;
        setWallet(newBalance);
        return newBalance;
    } catch (err) {
        console.error("Failed to update wallet:", err.response ? err.response.data : err.message);
        toast.error("Failed to update wallet balance.");
        // Re-fetch current wallet state if update failed
        fetchWalletData(); 
        return wallet; // Return current state as a fallback
    }
};

 
  return (
    
   <div className="spinner-container">
      {/* -------------------- Custom Styles Block (Merged from your CSS) -------------------- */}
      
      <style>
        {`
        /* Load Inter font */
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');

        /* SpinnerWheel.css - ADAPTED FOR SINGLE FILE */
        .spinner-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: linear-gradient(135deg, #dacfe6 0%, #03173aff 100%);
          font-family: 'Inter', sans-serif; /* Changed to Inter */
          color: white;
          padding: 20px;
          box-sizing: border-box;
        }

        h1 {
          margin-bottom: 40px;
          text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
          font-size: 2.5rem;
          font-weight: 900;
        }

        .wheel-container {
          position: relative;
          width: 400px;
          height: 400px;
          margin-bottom: 40px;
        }

        .wheel {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          position: relative;
          box-shadow: 0 0 25px rgba(0, 0, 0, 0.4);
          border: 10px solid #fff;
          
          /* IMPORTANT: Transition is applied dynamically in JS */
          transition: transform 4s cubic-bezier(0.2, 0.8, 0.3, 1);
          transform: rotate(0deg);
          transform-origin: center center;
          overflow: hidden; /* To keep labels inside */
        }
        
        /* Segment labels are now handled by this class */
        .segment-label {
          /* Positioning the label */
          position: absolute;
          width: 50%;
          height: 50%;
          top: 0;
          left: 50%;
          transform-origin: 0% 100%; /* Anchor at the center of the wheel */
          
          /* Content container to move the number/icon outward */
          display: flex;
          align-items: center;
          justify-content: center;
          padding-left: 10px; /* Push content away from the center */
        }
        
        /* Inner container to hold text/icon and counter-rotate it */
        .segment-content {
          /* Counter-rotate the text to make it level on the screen */
          transform: rotate(-${segmentAngle / 2}deg); 
          display: flex;
          align-items: center;
          color: white;
          text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.7);
        }

        .number {
          font-size: 30px;
          font-weight: bold;
          margin-left: 5px;
        }
        .segment-icon {
          font-size: 24px;
        }

        .center-circle {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 80px;
          height: 80px;
          background: white;
          border-radius: 50%;
          border: 5px solid #ff4757;
          z-index: 5;
          box-shadow: 0 0 15px rgba(0, 0, 0, 0.3);
        }

        .pointer {
          position: absolute;
          /* Position above the wheel */
          top: -30px; 
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          /* Triangle shape */
          border-left: 20px solid transparent;
          border-right: 20px solid transparent;
          border-top: 30px solid #ff4757; 
          z-index: 10;
          box-shadow: 0 0 15px rgba(0, 0, 0, 0.4);
        }

        .controls {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 25px;
        }

        .spin-button {
          padding: 18px 50px;
          font-size: 20px;
          font-weight: bold;
          background: linear-gradient(to right, #ff8a00, #da1b60);
          color: white;
          border: none;
          border-radius: 50px;
          cursor: pointer;
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
          transition: all 0.3s ease;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .spin-button:hover:not(:disabled) {
          transform: translateY(-4px);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.4);
          background: linear-gradient(to right, #ff9500, #e84168);
        }

        .spin-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .result {
          text-align: center;
          animation: fadeIn 0.5s ease;
          background: rgba(255, 255, 255, 0.1);
          padding: 20px 30px;
          border-radius: 15px;
          backdrop-filter: blur(10px);
          margin-top: 20px;
        }

        .result h2 {
          margin-bottom: 20px;
          text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);
          font-size: 1.8rem;
          color: #ffeb3b;
        }

        .reset-button {
          padding: 12px 30px;
          font-size: 16px;
          font-weight: bold;
          background: linear-gradient(to right, #00b09b, #96c93d);
          color: white;
          border: none;
          border-radius: 30px;
          cursor: pointer;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
          transition: all 0.3s ease;
        }

        .reset-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
          background: linear-gradient(to right, #00c9a7, #a8e063);
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Responsive design */
        @media (max-width: 480px) {
          .wheel-container {
            width: 300px;
            height: 300px;
          }
          
          .number {
            font-size: 20px;
          }
          
          .segment-label {
            padding-left: 5px;
          }

          .segment-content {
             /* Adjust counter rotation for smaller screen if needed */
          }
          
          .center-circle {
            width: 60px;
            height: 60px;
          }
          
          .spin-button {
            padding: 15px 40px;
            font-size: 18px;
          }
          
          h1 {
            font-size: 2rem;
          }
        }
        `}
      </style>
      {/* -------------------- END Custom Styles Block -------------------- */}

      <h1 className="text-4xl font-black tracking-wide">Prize Wheel of Fortune</h1>
    <h2 style={{
  fontSize: '2rem',
  fontWeight: 'bold',
  color: '#4e2b03e5',
  textShadow: '0 0 10px #282e2dff, 0 0 20px #292f2eff',
  background: 'rgba(0, 0, 0, 0.3)',
  padding: '15px 25px',
  borderRadius: '12px',
  backdropFilter: 'blur(6px)',
  margin: '20px 0',
  textAlign: 'center'
}}>
    Your balance: {Math.floor(wallet)}
</h2>

     
      <div className="wheel-container">
        
        {/* The wheel now uses the conicGradient for seamless colors */}
        <div
          className="wheel"
          ref={wheelRef}
          style={{ 
            background: conicGradient,
          }}
        >
          {/* Map through segments to position the text and icons */}
          {segmentThemes.map((theme, index) => {
            const rotation = index * segmentAngle;
            
            return (
              <div
                key={index}
                className="segment-label"
                // Rotate the label container to its position on the wheel
                style={{
                  transform: `rotate(${rotation}deg)`,
                }}
              >
                {/* Content is counter-rotated to stay upright */}
                <div className="segment-content">
                  <span className="segment-icon">
                    {theme.icon}
                  </span>
                  <span className="number">
                    {theme.value}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="pointer"></div>
        <div className="center-circle"></div>
      </div>

      <div className="controls">
      {result === null && (
  <button onClick={spinWheel} disabled={spinning} className="spin-button">
    {spinning ? 'Spinning...' : 'SPIN'}
  </button>
)}
        {result !== null && (
          <div className="result">
            <h2>{getResultMessage(result)}</h2>
            <button onClick={resetWheel} className="reset-button">Play Again</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SpinnerSelection;