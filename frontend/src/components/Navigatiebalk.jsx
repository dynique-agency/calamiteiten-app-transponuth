import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext.jsx';
import useSyncManager from '../hooks/useSyncManager.js';

// ── Iconen (SVG inline — geen externe bibliotheek nodig) ──────────────────────

function IcoonHuis({ actief }) {
  return (
    <svg viewBox="0 0 24 24" fill={actief ? 'currentColor' : 'none'} stroke="currentColor"
         strokeWidth={actief ? 0 : 1.7} className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round"
            d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  );
}

function IcoonPlus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-7 h-7">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function IcoonLijst({ actief }) {
  return (
    <svg viewBox="0 0 24 24" fill={actief ? 'currentColor' : 'none'} stroke="currentColor"
         strokeWidth={actief ? 0 : 1.7} className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round"
            d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
  );
}

function IcoonAdmin({ actief }) {
  return (
    <svg viewBox="0 0 24 24" fill={actief ? 'currentColor' : 'none'} stroke="currentColor"
         strokeWidth={actief ? 0 : 1.7} className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round"
            d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function IcoonWolk({ kleur = 'currentColor' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={kleur} strokeWidth={2} className="w-3.5 h-3.5">
      <path strokeLinecap="round" strokeLinejoin="round"
            d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
    </svg>
  );
}

// ── Navigatiebalk — bottom-tab-stijl (iOS/Android) ───────────────────────────

/**
 * Navigatiebalk — Twee-laags component:
 *   1. Topbalk : App-logo + verbindingsindicator + gebruikersnaam
 *   2. Onderbalk: Tab-navigatie (Home, Wizard, Calamiteiten, Admin)
 *
 * Stijl: glassmorphism, Framer Motion actieve indicator
 */
export default function Navigatiebalk() {
  const { gebruiker, isAdmin, uitloggen } = useAuth();
  const { isOnline, wachtrijAantal, isSynchroniserend } = useSyncManager();
  const locatie  = useLocation();
  const navigate = useNavigate();

  // Tab-definities — Admin-tab alleen zichtbaar voor Admins
  const tabs = [
    { pad: '/',              label: 'Dashboard',  icoon: (a) => <IcoonHuis actief={a} /> },
    { pad: '/calamiteiten',  label: 'Dossiers',   icoon: (a) => <IcoonLijst actief={a} /> },
    { pad: '/wizard',        label: null,          icoon: ()  => <IcoonPlus />, isActie: true },
    ...(isAdmin ? [{ pad: '/admin', label: 'Admin', icoon: (a) => <IcoonAdmin actief={a} /> }] : []),
  ];

  function isActief(pad) {
    if (pad === '/') return locatie.pathname === '/';
    return locatie.pathname.startsWith(pad);
  }

  function handleUitloggen() {
    uitloggen();
    navigate('/inloggen', { replace: true });
  }

  return (
    <>
      {/* ── Topbalk ─────────────────────────────────────────────────────── */}
      <header className="fixed top-0 inset-x-0 z-40 glas-nav" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex items-center justify-between px-5 h-14">
          {/* Logo + naam */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-accent flex items-center justify-center shadow-accent-sm">
              <span className="text-white font-black text-sm leading-none">TN</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-slate-100 leading-tight">Transpo-Nuth</span>
              <span className="text-[10px] text-slate-500 leading-none">Calamiteiten App</span>
            </div>
          </div>

          {/* Rechts: verbindingsstatus + gebruiker */}
          <div className="flex items-center gap-3">
            {/* Verbindingsindicator */}
            <AnimatePresence>
              {!isOnline && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-yellow-500/15 border border-yellow-500/30"
                >
                  <IcoonWolk kleur="#EAB308" />
                  <span className="text-yellow-400 text-[10px] font-semibold">Offline</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Sync-badge (telt offline wachtrij-items) */}
            <AnimatePresence>
              {wachtrijAantal > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="relative"
                >
                  <motion.div
                    animate={isSynchroniserend ? { rotate: 360 } : { rotate: 0 }}
                    transition={{ repeat: isSynchroniserend ? Infinity : 0, duration: 1, ease: 'linear' }}
                    className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center"
                  >
                    <IcoonWolk kleur="#F97316" />
                  </motion.div>
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {wachtrijAantal}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Gebruikers-avatar met initialen */}
            <button
              onClick={handleUitloggen}
              className="w-8 h-8 rounded-full bg-merk-licht/30 border border-white/10 flex items-center justify-center text-xs font-bold text-slate-200 active:scale-95 transition-transform"
              aria-label={`Uitloggen (${gebruiker?.naam})`}
            >
              {gebruiker?.naam?.charAt(0)?.toUpperCase() ?? '?'}
            </button>
          </div>
        </div>
      </header>

      {/* ── Onderbalk (tab-navigatie) ────────────────────────────────────── */}
      <nav
        className="fixed bottom-0 inset-x-0 z-40 glas-nav veilige-zone-onder"
        aria-label="Hoofdnavigatie"
      >
        <div className="flex items-end justify-around px-2 pt-2 pb-1">
          {tabs.map((tab) => {
            const actief = isActief(tab.pad);

            // Centrale actie-knop (wizard starten)
            if (tab.isActie) {
              return (
                <Link
                  key={tab.pad}
                  to={tab.pad}
                  className="relative -mt-5 touch-doelwit"
                  aria-label="Nieuwe calamiteit aanmaken"
                >
                  <motion.div
                    whileTap={{ scale: 0.90 }}
                    className="w-14 h-14 rounded-2xl bg-accent shadow-accent flex items-center justify-center text-white"
                    style={{ boxShadow: '0 4px 20px rgba(249,115,22,0.45)' }}
                  >
                    {tab.icoon(false)}
                  </motion.div>
                </Link>
              );
            }

            // Normale tab
            return (
              <Link
                key={tab.pad}
                to={tab.pad}
                className="relative flex flex-col items-center gap-1 px-4 py-2 touch-doelwit rounded-xl"
                aria-current={actief ? 'page' : undefined}
              >
                {/* Actieve indicator — gevulde pil achter het icoon */}
                <AnimatePresence>
                  {actief && (
                    <motion.span
                      layoutId="nav-actief-indicator"
                      className="absolute inset-0 bg-accent/15 rounded-xl"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                </AnimatePresence>

                {/* Icoon */}
                <motion.span
                  animate={{ color: actief ? '#F97316' : '#64748B' }}
                  transition={{ duration: 0.2 }}
                  className="relative z-10"
                >
                  {tab.icoon(actief)}
                </motion.span>

                {/* Label */}
                <motion.span
                  animate={{
                    color:    actief ? '#F97316' : '#64748B',
                    fontWeight: actief ? 600 : 400,
                  }}
                  className="relative z-10 text-[10px] leading-none"
                >
                  {tab.label}
                </motion.span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
