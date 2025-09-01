// New and Improved ProtectedRoute.js
import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

function ProtectedRoute() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  
  // Get all required parameters from the URL
  const usernameFromUrl = searchParams.get("username");
  const telegramIdFromUrl = searchParams.get("telegramId");
  const roomIdFromUrl = searchParams.get("roomId"); // ✅ Get roomId from URL
  const stakeFromUrl = searchParams.get("stake"); // ✅ Get stake from URL

  // Stored credentials
  const storedUsername = localStorage.getItem("username");
  const storedTelegramId = localStorage.getItem("telegramId");

  // Token
  const token = localStorage.getItem("accesstoken");

  // Decide which values to use (prioritizing URL)
  const username = usernameFromUrl || storedUsername;
  const telegramId = telegramIdFromUrl || storedTelegramId;

  // Auth check
  const isAuthenticated = (username && telegramId) || token;

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // Save fresh values if coming from URL
  if (usernameFromUrl && telegramIdFromUrl) {
    localStorage.setItem("username", usernameFromUrl);
    localStorage.setItem("telegramId", telegramIdFromUrl);
  }

  // ✅ Pass all parameters to children via context
  return (
    <Outlet 
        context={{ 
            usernameFromUrl: username, 
            telegramIdFromUrl: telegramId,
            roomIdFromUrl: roomIdFromUrl, // ✅ Pass roomId
            stakeFromUrl: stakeFromUrl,   // ✅ Pass stake
        }} 
    />
  );
}

export default ProtectedRoute;