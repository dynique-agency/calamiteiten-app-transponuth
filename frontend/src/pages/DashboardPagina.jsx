import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext.jsx';
import useSyncManager from '../hooks/useSyncManager.js';
import api from '../utils/apiClient.js';

// ── Animatie-helpers ──────────────────────────────────────────────────────────

const lijstVarianten = {
  zichtbaar: { transition: { staggerChildren: 0.06 } },
};
const kaartVariant = {
  initieel:  { opacity: 0, y: 16 },
  zichtbaar: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25,0.1,0.25,1] } },
};

// ── Snelkoppeling-definitie ───────────────────────────────────────────────────

function SnelkoppelingKaart({ naar, emoji, titel, ondertitel, accentkleur = 'bg-merk/20' }) {
  return (
    <motion.div variants={kaartVariant}>
      <Link to={naar}>
        <motion.div
          whileTap={{ scale: 0.97 }}
          className="glas-kaart rounded-2xl p-4 flex items-center gap-4 transition-all duration-250 active:glas-kaart-hover"
        >
          <span className={`w-12 h-12 rounded-2xl ${accentkleur} flex items-center justify-center text-2xl shrink-0`}>
            {emoji}
          </span>
          <div>
            <p className="text-slate-100 font-semibold text-sm">{titel}</p>
            <p className="text-slate-500 text-xs mt-0.5">{ondertitel}</p>
          </div>
          <svg className="w-4 h-4 text-slate-600 ml-auto shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </motion.div>
      </Link>
    </motion.div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

/**
 * DashboardPagina — Startpagina na inloggen.
 *
 * Secties:
 *   1. Begroeting + datum
 *   2. Snelle statistieken (concept/ingezonden)
 *   3. Snelkoppelingen
 *   4. Externe portal-link (MobilityPlanner — conform business rules)
 */
export default function DashboardPagina() {
  const { gebruiker, isAdmin } = useAuth();
  const { isOnline, wachtrijAantal } = useSyncManager();

  const [statistieken, setStatistieken] = useState({ concept: 0, ingezonden: 0 });
  const [isLadend,     setIsLadend]     = useState(true);

  // ── Statistieken ophalen ──────────────────────────────────────────────────
  useEffect(() => {
    async function laadStatistieken() {
      try {
        const [conceptRes, ingezondenRes] = await Promise.all([
          api.get('/api/calamiteiten?status=Concept&limit=1'),
          api.get('/api/calamiteiten?status=Ingezonden&limit=1'),
        ]);
        setStatistieken({
          concept:    conceptRes.aantal    ?? 0,
          ingezonden: ingezondenRes.aantal ?? 0,
        });
      } catch {
        // Statistieken zijn niet kritisch — stil mislukken
      } finally {
        setIsLadend(false);
      }
    }
    laadStatistieken();
  }, []);

  // ── Datum-formatting ──────────────────────────────────────────────────────
  const datum = new Date().toLocaleDateString('nl-NL', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
  // Eerste letter hoofdletter
  const datumGeformateerd = datum.charAt(0).toUpperCase() + datum.slice(1);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <motion.div
      variants={lijstVarianten}
      initial="initieel"
      animate="zichtbaar"
      className="flex flex-col gap-6"
    >
      {/* ── Sectie 1: Begroeting ────────────────────────────────────────── */}
      <motion.div variants={kaartVariant}>
        <p className="text-slate-500 text-sm">{datumGeformateerd}</p>
        <h1 className="text-2xl font-bold text-slate-100 mt-1">
          Hallo, {gebruiker?.naam?.split(' ')[0] ?? 'medewerker'} 👋
        </h1>
        {/* Offline-waarschuwing */}
        {!isOnline && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-3 flex items-center gap-2 px-4 py-3 bg-yellow-500/10 border border-yellow-500/25 rounded-2xl"
          >
            <span className="text-yellow-400 text-lg">☁️</span>
            <div>
              <p className="text-yellow-400 text-sm font-medium">Offline modus</p>
              <p className="text-yellow-600 text-xs">
                {wachtrijAantal > 0
                  ? `${wachtrijAantal} aanvraag(en) wachten op synchronisatie`
                  : 'Wijzigingen worden bewaard tot de verbinding is hersteld'}
              </p>
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* ── Sectie 2: Statistieken ───────────────────────────────────────── */}
      <motion.div variants={kaartVariant} className="grid grid-cols-2 gap-3">
        {/* Concept */}
        <div className="glas-kaart rounded-2xl p-4">
          {isLadend ? (
            <div className="skelet w-12 h-8 mb-2" />
          ) : (
            <p className="text-3xl font-bold text-slate-100">{statistieken.concept}</p>
          )}
          <p className="text-xs text-slate-500 mt-1">Concept</p>
          <span className="badge-concept mt-2">• Concept</span>
        </div>
        {/* Ingezonden */}
        <div className="glas-kaart rounded-2xl p-4">
          {isLadend ? (
            <div className="skelet w-12 h-8 mb-2" />
          ) : (
            <p className="text-3xl font-bold text-slate-100">{statistieken.ingezonden}</p>
          )}
          <p className="text-xs text-slate-500 mt-1">Ingezonden</p>
          <span className="badge-ingezonden mt-2">• Ingezonden</span>
        </div>
      </motion.div>

      {/* ── Sectie 3: Snelkoppelingen ────────────────────────────────────── */}
      <div className="flex flex-col gap-2.5">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">Snel starten</p>

        <SnelkoppelingKaart
          naar="/wizard"
          emoji="🚧"
          titel="Nieuwe Calamiteit"
          ondertitel="Start de registratie-wizard"
          accentkleur="bg-accent/20"
        />
        <SnelkoppelingKaart
          naar="/calamiteiten"
          emoji="📋"
          titel="Mijn Dossiers"
          ondertitel="Bekijk uw calamiteiten"
          accentkleur="bg-merk/20"
        />
        {isAdmin && (
          <SnelkoppelingKaart
            naar="/admin"
            emoji="⚙️"
            titel="Admin Dashboard"
            ondertitel="Stamdata, gebruikers & exports"
            accentkleur="bg-slate-500/20"
          />
        )}
      </div>

      {/* ── Sectie 4: Externe portal-link (business rule) ────────────────── */}
      <motion.div variants={kaartVariant}>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1 mb-2.5">Externe links</p>
        <motion.a
          href="https://portal.mobilityplanner.com"
          target="_blank"
          rel="noopener noreferrer"
          whileTap={{ scale: 0.97 }}
          className="glas-kaart rounded-2xl p-4 flex items-center gap-4 no-underline block"
        >
          <span className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center text-2xl shrink-0">
            🗺️
          </span>
          <div className="flex-1">
            <p className="text-slate-100 font-semibold text-sm">MobilityPlanner Portal</p>
            <p className="text-slate-500 text-xs mt-0.5">portal.mobilityplanner.com</p>
          </div>
          {/* Extern-link icoon */}
          <svg className="w-4 h-4 text-slate-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
        </motion.a>
      </motion.div>
    </motion.div>
  );
}
