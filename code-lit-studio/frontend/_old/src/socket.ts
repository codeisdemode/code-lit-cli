// frontend/src/socket.ts

import { io, Socket } from 'socket.io-client';

// Initialize the Socket.IO client
const socket: Socket = io('http://localhost:3001', {
  autoConnect: false, // Prevents automatic connection upon import
});

// Function to establish the connection
export const connectSocket = () => {
  if (!socket.connected) {
    socket.connect();
  }
};

export default socket;
