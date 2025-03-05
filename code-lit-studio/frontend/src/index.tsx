import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css'; // Optional: For any global styles
import { connectSocket } from './socket'; // Import the connectSocket function

// Establish the Socket.IO connection
connectSocket();

const rootElement = document.getElementById('root');

if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  // Removed <React.StrictMode> to avoid double mounting in development
  root.render(
    // <React.StrictMode>
      <App />
    // </React.StrictMode>
  );
} else {
  console.error("Root element not found. Ensure there's a div with id 'root' in your index.html.");
}
