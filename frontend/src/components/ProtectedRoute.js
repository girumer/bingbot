import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

function ProtectedRoute() {
  const location = useLocation();
  
  // Get parameters from the URL
  const searchParams = new URLSearchParams(location.search);
  const usernameFromUrl = searchParams.get('username');
  const telegramIdFromUrl = searchParams.get('telegramId');
  
  // Check for stored credentials (from previous authentication)
  const storedUsername = localStorage.getItem('username');
  const storedTelegramId = localStorage.getItem('telegramId');
  
  // Check for token authentication
  const token = localStorage.getItem('accesstoken');
  
  // Allow access if any authentication method is available
  const isAuthenticated = 
    (!!usernameFromUrl && !!telegramIdFromUrl) || 
    (!!storedUsername && !!storedTelegramId) || 
    !!token;

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  
  // If we have URL parameters, store them for future use
  if (usernameFromUrl && telegramIdFromUrl) {
    localStorage.setItem('username', usernameFromUrl);
    localStorage.setItem('telegramId', telegramIdFromUrl);
  }

  return <Outlet />;
}

export default ProtectedRoute;