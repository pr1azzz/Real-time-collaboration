import { io } from 'socket.io-client';

let socket = null;

export const initSocket = (token) => {
  socket = io(import.meta.env.VITE_WS_URL || 'http://localhost:5000', {
    auth: { token },
  });
  
  socket.on('connect', () => {
    console.log('WebSocket connected');
  });
  
  socket.on('disconnect', () => {
    console.log('WebSocket disconnected');
  });
  
  return socket;
};

export const getSocket = () => socket;

export const closeSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};