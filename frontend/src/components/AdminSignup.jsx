
import React, { useState,useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axios from 'axios';
import './Logins.css';
import Cookies from "js-cookie";
function AdminSignup() {
  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
    const navigate=useNavigate();
    const accessToken = Cookies.get('accesstoken');
    //const refreshToken = Cookies.get("refreshtoken");
    console.log("access token is ",accessToken);
    axios.defaults.withCredentials=true;
   
    const [formData,setFormData]=useState({
       username:'',
       password:'',
    
    })
     const handleInputChange=(event)=>{
      const {name,value}=event.target;
      setFormData({
        ...formData,
        [name]:value
      })
    
     }
     
        
     const handleSubmit = async (e) => {
      e.preventDefault();
      const username=formData.username;
      const password=formData.password;
        axios.post(`${BACKEND_URL}/loginuseradminstre`, {username,password})
        .then(res=>{
         // console.log(res.data)
        if( res.data.Admin){
          navigate("/Dashbord",{state:{id:username}})
        }
        else{
          navigate("/qazxsw")
        }
         // navigate("/BingoBoard")
        })
        .catch(err=>console.log(err));
        
     }
    
  return (
    
    <div className="login-container">
    <h2>AdminSignup</h2>
    <form className="login-form" onSubmit={handleSubmit}>
        <div className="form-group">
            <label for="username">Username</label>
            <input type="text" id="username" name="username" 
            value={formData.username}
            onChange={handleInputChange}
            required />
        </div>
        <div className="form-group">
            <label for="password">Password</label>
            <input type="password" id="password" name="password" required
             value={formData.password}
             onChange={handleInputChange}
            />
        </div>
        <button type="submit" className="submit-button">Create Account</button>
    </form>
</div>

  )
}


export default  AdminSignup