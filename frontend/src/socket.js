// src/socket.js
import { io } from "socket.io-client";

// Change this to your backend server URL
const socket = io("http://localhost:5000", {
  withCredentials: true,
});

export default socket;
