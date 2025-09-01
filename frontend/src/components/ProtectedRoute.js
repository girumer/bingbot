import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

function ProtectedRoute({ children }) {
  const location = useLocation();
  const token = localStorage.getItem('accesstoken');
  
  // Get the username from the URL query parameters
  const searchParams = new URLSearchParams(location.search);
  const usernameFromUrl = searchParams.get('username');
  
  // A simple flag to check if the user is considered "authenticated"
  // This is true if an access token exists OR if the app is launched from the bot
  const isAuthenticated = !!token || !!usernameFromUrl;

  // The is-logged-in flag in localStorage is now redundant since we are checking
  // the token or URL parameter, which are the sources of truth.

  // Use the isAuthenticated flag to decide where to navigate
  return isAuthenticated ? <Outlet /> : <Navigate to="/" replace />;
}

export default ProtectedRoute;