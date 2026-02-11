import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Global error handler untuk membantu debugging di Netlify
window.onerror = function(message, source, lineno, colno, error) {
  console.error("Global Error Caught:", message, "at", source, ":", lineno);
  return false;
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  const fallback = document.createElement('div');
  fallback.style.color = 'white';
  fallback.style.padding = '20px';
  fallback.innerHTML = '<h1>Critical Error</h1><p>Root element not found. Please refresh.</p>';
  document.body.appendChild(fallback);
  throw new Error("Could not find root element to mount to");
}

try {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (e) {
  console.error("React Mounting Failed:", e);
  rootElement.innerHTML = `<div style="color:white;padding:20px;"><h1>Runtime Error</h1><p>${e.message}</p></div>`;
}
