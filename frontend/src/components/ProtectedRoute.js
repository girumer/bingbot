import React from 'react';
import { Navigate,Outlet } from 'react-router-dom';

function ProtectedRoute({ isAuthenticated, children }) {
  const token = localStorage.getItem('accesstoken');  
 // return isAuthenticated ? children : <Navigate to="/" replace />;
 return token ? <Outlet/> : <Navigate to="/" replace/>
}

export default ProtectedRoute;
