import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

function ProtectedRoute() {
  const location = useLocation();
  
  // Get parameters from the URL
  const searchParams = new URLSearchParams(location.search);
  const usernameFromUrl = searchParams.get('username');
  const telegramIdFromUrl = searchParams.get('telegramId');
  
  // Check if we have Telegram authentication from URL
  const isFromTelegramBot = !!usernameFromUrl && !!telegramIdFromUrl;
  
  // Check if we have stored credentials
  const storedUsername = localStorage.getItem('username');
  const storedTelegramId = localStorage.getItem('telegramId');
  const hasStoredCredentials = !!storedUsername && !!storedTelegramId;
  
  // Check if we have token authentication
  const token = localStorage.getItem('accesstoken');
  
  // Allow access if any authentication method is available
  const isAuthenticated = isFromTelegramBot || hasStoredCredentials || !!token;

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  
  // If we have URL parameters, store them
  if (isFromTelegramBot) {
    localStorage.setItem('username', usernameFromUrl);
    localStorage.setItem('telegramId', telegramIdFromUrl);
  }

  return <Outlet />;
}

export default ProtectedRoute;