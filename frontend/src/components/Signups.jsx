import React, { useState } from 'react';
import Navbar from '../components/Navbar';
import './Signups.css';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function Signups() {
  axios.defaults.withCredentials = true;
  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    username: '',
    phoneNumber: '',
  
  });

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

 const handleSubmit = async (e) => {
  e.preventDefault();
  const { username, phoneNumber} = formData;

  // Frontend validation
  if (!username || !phoneNumber ) {
    alert("Please fill in all required fields!");
    return;
  }

  try {
    const res = await axios.post(
      `${BACKEND_URL}/auth/register`,
      {
        username,
        phoneNumber,

      
      },
      { withCredentials: true }
    );

    if (res.data.message === "User registered successfully") {
      navigate("/Logins");
    } else {
      alert("back end siad "); // show backend message
    }
  } catch (err) {
    console.log(err);
    alert("Network error. Please try again.");
  }
};

  return (
    <React.Fragment>
 
      <div className="signup-container">
        <h2>Sign Up</h2>
        <form className="signup-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input 
              type="text" 
              id="username" 
              name="username" 
              value={formData.username} 
              onChange={handleInputChange} 
              required 
            />
          </div>

          <div className="form-group">
            <label htmlFor="phoneNumber">Phone Number</label>
            <input 
              type="text" 
              id="phoneNumber" 
              name="phoneNumber" 
              value={formData.phoneNumber} 
              onChange={handleInputChange} 
              required 
            />
          </div>

          

          <button type="submit" className="submit-button">Create Account</button>
        </form>
      </div>
    </React.Fragment>
  );
}

export default Signups;
