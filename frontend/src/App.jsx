import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';

import BeschermdRoute from './router/BeschermdRoute.jsx';
import AppLayout      from './layouts/AppLayout.jsx';
import Laadscherm     from './components/Laadscherm.jsx';

// ── Lazy loading per pagina (verkleint de initiële bundel-grootte) ─────────────
const InloggenPagina    = lazy(() => import('./pages/InloggenPagina.jsx'));
const DashboardPagina   = lazy(() => import('./pages/DashboardPagina.jsx'));
const NietGevondenPagina= lazy(() => import('./pages/NietGevondenPagina.jsx'));

// Admin-pagina's (alleen geladen als de gebruiker Admin is)
const AdminDashboard    = lazy(() => import('./pages/admin/AdminDashboard.jsx'));
const StamdataPagina    = lazy(() => import('./pages/admin/StamdataPagina.jsx'));
const GebruikersPagina  = lazy(() => import('./pages/admin/GebruikersPagina.jsx'));

// Wizard (Fase 5)
const WizardPagina      = lazy(() => import('./pages/wizard/WizardPagina.jsx'));
const CalamiteitenLijst = lazy(() => import('./pages/CalamiteitenLijst.jsx'));

// ── Tijdelijke placeholder voor nog te bouwen pagina's (Fase 5/6) ─────────────
function PlaceholderPagina({ titel }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8 text-center">
      <div className="w-16 h-16 rounded-3xl bg-accent/20 flex items-center justify-center">
        <span className="text-3xl">🚧</span>
      </div>
      <h1 className="text-2xl font-bold text-slate-100">{titel}</h1>
      <p className="text-slate-400 text-sm max-w-xs">
        Deze pagina wordt gebouwd in Fase 5 of 6. De routing en beveiliging werken al correct.
      </p>
    </div>
  );
}

// ── Hoofd-routing-boom ────────────────────────────────────────────────────────

export default function App() {
  const locatie = useLocation();

  return (
    /*
      AnimatePresence: laat pagina's animeren bij het wisselen van route.
      mode="wait": wacht tot de uitgangsanimatie klaar is vóór de nieuwe pagina verschijnt.
      De locatie.pathname is de key zodat React weet wanneer een route wisselt.
    */
    <AnimatePresence mode="wait" initial={false}>
      <Suspense fallback={<Laadscherm volledigeHoogte />}>
        <Routes location={locatie} key={locatie.pathname}>

          {/* ── Publieke routes ──────────────────────────────────────────── */}
          <Route path="/inloggen" element={<InloggenPagina />} />

          {/* ── Beschermde routes (alle ingelogde gebruikers) ────────────── */}
          <Route
            element={
              <BeschermdRoute>
                <AppLayout />
              </BeschermdRoute>
            }
          >
            {/* Dashboard — startpagina na inloggen */}
            <Route index element={<DashboardPagina />} />
            <Route path="dashboard" element={<Navigate to="/" replace />} />

            {/* Calamiteiten */}
            <Route path="calamiteiten" element={<CalamiteitenLijst />} />

            {/* Wizard: nieuwe calamiteit aanmaken */}
            <Route path="wizard/*" element={<WizardPagina />} />

            {/* ── Admin-only routes ──────────────────────────────────── */}
            <Route
              path="admin"
              element={<BeschermdRoute vereistAdmin><AdminDashboard /></BeschermdRoute>}
            />
            <Route
              path="admin/stamdata"
              element={<BeschermdRoute vereistAdmin><StamdataPagina /></BeschermdRoute>}
            />
            <Route
              path="admin/gebruikers"
              element={<BeschermdRoute vereistAdmin><GebruikersPagina /></BeschermdRoute>}
            />
          </Route>

          {/* ── Fallback ─────────────────────────────────────────────────── */}
          <Route path="*" element={<NietGevondenPagina />} />

        </Routes>
      </Suspense>
    </AnimatePresence>
  );
}
