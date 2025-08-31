import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

function ProtectedRoute() {
  const location = useLocation();
  
  // Get parameters from the URL
  const searchParams = new URLSearchParams(location.search);
  const usernameFromUrl = searchParams.get('username');
  const telegramIdFromUrl = searchParams.get('telegramId');
  
  // Only allow access if coming from Telegram bot with required parameters
  const isFromTelegramBot = !!usernameFromUrl && !!telegramIdFromUrl;
  
  // Also allow access with token for other authentication methods (optional)
  const token = localStorage.getItem('accesstoken');
  const isAuthenticated = isFromTelegramBot || !!token;

  if (!isAuthenticated) {
    // Redirect to home page if not authenticated
    return <Navigate to="/" replace />;
  }

  // Pass the URL parameters to child components using location state
  return <Outlet context={{ usernameFromUrl, telegramIdFromUrl }} />;
}

export default ProtectedRoute;