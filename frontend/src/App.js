// import './App.css'
import React from 'react';
import { useState,useEffect } from 'react';
import socket from "./socket";
import "react-toastify/dist/ReactToastify.css";
import Mainmenu from "./components/Mainmenu";
import GameHistory from "./components/Gamehistory";
import Helpdesk from "./components/Helpdesk";
import BingoBoard from "./components/BingoBoard";
import CartelaSelction from "./components/CartelaSelction";
import Signups from "./components/Signups";
import Logins from "./components/Logins";
import Dashbord from "./components/Dashboard";
import Report from './components/Report';
import DepositPage from './components/DepositPage';
import AdminLogin from './components/AdminLogin';
import TransactionHistoryPage from './components/TransactionHistoryPage';
import ProtectedAdminRoute from './components/ProtectedAdminRoute';
import { ToastContainer } from "react-toastify";
import AdminDashboard from './components/AdminDashboard';
import AdminSignup from './components/AdminSignup';
import WalletPage from './components/WalletPage';
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import AdminPasswordReset from './components/AdminPasswordReset';

import ProtectedRoute from './components/ProtectedRoute';
import axios from "axios"
function App() {
  

  
   
    const token = localStorage.getItem('accesstoken');
     

  return (
    <div className="App">
       <ToastContainer
        position="top-center"
        autoClose={3000} // 3 seconds
        hideProgressBar={false}
        newestOnTop={true}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
   
      <Router>
        <Routes>
        
          <Route path="/" element={<Logins/>}/>
         
          <Route path="/qazxsw" element={<AdminSignup/>}/>
           <Route path="/AdminPasswordReset" element={<AdminPasswordReset/>}/>
            <Route path="/Adminsu" element={<AdminSignup/>}/>
          <Route path="/Logins"  element={<Logins/>}/>
          <Route path="/signups" element={<Signups /> }/>
          <Route path="/qbzxsw" element={<AdminLogin />} />
          <Route element={<ProtectedAdminRoute />}>
  <Route path="/AdminDashboard" element={<AdminDashboard />} />
</Route>

          {/* protected toutes*/ }
          <Route element={<ProtectedRoute/>}>
          <Route path="/Dashbord" element={<Dashbord/>}/>
           
            <Route path="/wallet" element={<WalletPage/>}/>
          <Route path="/Report" element={<Report />} />
          <Route path="/mainmenu" element={<Mainmenu/>}/>
           <Route path="/GameHistory" element={<GameHistory/>}/>
          <Route path="/transhistory" element={< TransactionHistoryPage/>}/>
           <Route path="/CartelaSelction" element={<CartelaSelction/>}/>
            <Route  path="/deposit" element={<DepositPage/>}/>
          <Route path="/AdminDashboard" element={<AdminDashboard />} />
          <Route path="/BingoBoard" element={<BingoBoard/>}/>
          
         
          </Route>
        </Routes>
      </Router>
    </div>
  );
}

export default App;