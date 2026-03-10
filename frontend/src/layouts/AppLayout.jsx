import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Navigatiebalk from '../components/Navigatiebalk.jsx';

// ── Pagina-overgangsanimaties ─────────────────────────────────────────────────

/**
 * Varianten voor Framer Motion-pagina-overgangen.
 * Stijl: zachte verticale verschuiving + fade (iOS-achtig).
 */
const paginaVarianten = {
  initieel: {
    opacity: 0,
    y: 16,
    scale: 0.99,
  },
  zichtbaar: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.3,
      ease: [0.25, 0.1, 0.25, 1], // cubic-bezier Apple-ease
    },
  },
  uitgang: {
    opacity: 0,
    y: -8,
    scale: 0.99,
    transition: {
      duration: 0.2,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
};

// ── AppLayout ─────────────────────────────────────────────────────────────────

/**
 * AppLayout — De hoofdomhulling voor alle beveiligde pagina's.
 *
 * Structuur (van boven naar beneden):
 *   ┌─────────────────────────────────────────────────────┐
 *   │  Topbalk (glassmorphism, fixed)                     │  ← 56px
 *   ├─────────────────────────────────────────────────────┤
 *   │                                                     │
 *   │  <Outlet /> — Paginainhoud (scrollbaar)             │  ← flex-1
 *   │  (met Framer Motion pagina-overgangsanimatie)       │
 *   │                                                     │
 *   ├─────────────────────────────────────────────────────┤
 *   │  Onderbalk / Tab-navigatie (glassmorphism, fixed)   │  ← ~64px + safe-area
 *   └─────────────────────────────────────────────────────┘
 *
 * Merk op:
 *   - padding-top: 56px (hoogte topbalk)
 *   - padding-bottom: 80px (hoogte onderbalk + veilige zone)
 *   - De <Outlet /> gebruikt `key={locatie.pathname}` voor smooth pagina-overgangen
 */
export default function AppLayout() {
  const locatie = useLocation();

  return (
    <div className="flex flex-col min-h-screen bg-app-bg">

      {/* Navigatiebalk rendert zowel top- als onderbalk */}
      <Navigatiebalk />

      {/* ── Hoofdinhoud ────────────────────────────────────────────────── */}
      <main
        className="flex-1 w-full max-w-2xl mx-auto"
        style={{
          // Ruimte voor top- en onderbalk (inclusief safe-area-inset)
          paddingTop:    'calc(56px + env(safe-area-inset-top))',
          paddingBottom: 'calc(80px + env(safe-area-inset-bottom))',
        }}
      >
        {/*
          AnimatePresence + key={locatie.pathname}:
          elke routewisseling triggert de uitgangs- + inkomstanimatie.
          mode="wait" zorgt dat de vorige pagina eerst verdwijnt.
        */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={locatie.pathname}
            variants={paginaVarianten}
            initial="initieel"
            animate="zichtbaar"
            exit="uitgang"
            className="pagina-wrapper px-4 pt-5 pb-2"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
