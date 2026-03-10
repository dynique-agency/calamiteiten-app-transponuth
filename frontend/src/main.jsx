import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import './index.css';

// Service worker registratie — vite-plugin-pwa genereert 'virtual:pwa-register'
// We importeren het optioneel zodat de dev-build niet faalt als het bestand ontbreekt
if ('serviceWorker' in navigator) {
  import('virtual:pwa-register')
    .then(({ registerSW }) => {
      registerSW({
        onNeedRefresh() {
          // Stille auto-update — kan later uitgebreid worden met een toast
          console.info('[PWA] Nieuwe versie beschikbaar, wordt bijgewerkt...');
        },
        onOfflineReady() {
          console.info('[PWA] App is gereed voor offline gebruik.');
        },
      });
    })
    .catch(() => {
      // Tijdens development is het virtuele bestand niet beschikbaar — negeer
    });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/*
      BrowserRouter: HTML5 History API voor schone URL's (geen #-hashes).
      AuthProvider: JWT-state beschikbaar in de hele boom.
    */}
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
