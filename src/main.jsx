import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

const canUseWebServiceWorker = location.protocol === 'https:' || location.protocol === 'http:';
if (import.meta.env.PROD && canUseWebServiceWorker && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // PWA support is progressive enhancement; the web/native app remains usable.
    });
  });
}
