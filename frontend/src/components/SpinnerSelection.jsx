import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import './spinnerselection.css';
const SpinnerSelection = () => {
  const [searchParams] = useSearchParams();
  const [selectedNumbers, setSelectedNumbers] = useState([]);

  const username = searchParams.get("username");
  const telegramId = searchParams.get("telegramId");
  const stake = searchParams.get("stake");

  // Array from 1 to 100
  const numbers = Array.from({ length: 100 }, (_, i) => i + 1);

  const handleSelect = (num) => {
    if (selectedNumbers.includes(num)) {
      setSelectedNumbers(selectedNumbers.filter((n) => n !== num));
    } else {
      setSelectedNumbers([...selectedNumbers, num]);
    }
  };

  const handleSubmit = () => {
    if (selectedNumbers.length === 0) {
      alert("Please select at least one number");
      return;
    }
    console.log({
      username,
      telegramId,
      stake,
      selectedNumbers,
    });

    // TODO: Send the selected numbers to your server here
  };

  return (
    <div className="spinner-selection">
      <h2>Welcome, {username} 👋</h2>
      <p>Stake: {stake} ETB</p>
      <div className="number-grid">
        {numbers.map((num) => (
          <div
            key={num}
            className={`number-item ${selectedNumbers.includes(num) ? "selected" : ""}`}
            onClick={() => handleSelect(num)}
          >
            {num}
          </div>
        ))}
      </div>
      <button onClick={handleSubmit} className="submit-btn">
        Confirm Selection
      </button>
    </div>
  );
};

export default SpinnerSelection;
