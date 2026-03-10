/**
 * CalamiteitenLijst.jsx — Fase 6
 * ================================
 * Dossier-overzicht voor alle ingelogde gebruikers:
 *   - Medewerkers zien alleen hun eigen calamiteiten
 *   - Admins zien alle calamiteiten
 *   - Filter op status
 *   - Klikbaar voor een detail-accordion per rij
 *   - Premium kaart-layout met statusbadges
 */

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../utils/apiClient.js';
import { useAuth } from '../context/AuthContext.jsx';

// ── Hulpfuncties ──────────────────────────────────────────────────────────────

function formaatDatum(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('nl-NL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formaatDatumKort(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('nl-NL', {
    day: '2-digit', month: '2-digit', year: '2-digit',
  });
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const stijlen = {
    Concept:    'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
    Ingezonden: 'bg-status-succes/15 text-status-succes border-status-succes/25',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${stijlen[status] ?? 'bg-white/10 text-slate-400 border-white/15'}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {status}
    </span>
  );
}

// ── Uitklapbaar detail-kaartje ────────────────────────────────────────────────

function CalamiteitKaart({ cal, isOpen, onToggle }) {
  return (
    <motion.div
      layout
      className="glas-kaart rounded-2xl overflow-hidden"
    >
      {/* Hoofd-rij (altijd zichtbaar) */}
      <motion.button
        type="button"
        onClick={onToggle}
        whileTap={{ scale: 0.995 }}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        {/* Rijksweg-badge */}
        <div className="w-12 h-12 rounded-2xl bg-merk/25 border border-merk/40 flex flex-col items-center justify-center shrink-0">
          <p className="text-accent font-bold text-xs leading-none">{cal.rijksweg}</p>
          <p className="text-slate-400 text-[10px] mt-0.5">HMP</p>
          <p className="text-slate-300 text-[10px] font-semibold leading-none">{cal.hmp}</p>
        </div>

        {/* Inhoud */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-slate-100 font-semibold text-sm">{cal.rijksweg} — HMP {cal.hmp}</p>
            <StatusBadge status={cal.status} />
          </div>
          <p className="text-slate-500 text-xs mt-0.5 truncate">
            {formaatDatumKort(cal.tijdstip_melding)} · {cal.klant_naam ?? 'Onbekende klant'}
          </p>
        </div>

        {/* Pijl */}
        <motion.div
          animate={{ rotate: isOpen ? 90 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0"
        >
          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </motion.div>
      </motion.button>

      {/* Uitklapbare detail-sectie */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-white/6 pt-3 flex flex-col gap-3">
              {/* Detail-rijen */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {[
                  { label: 'Tijdstip melding',   waarde: formaatDatum(cal.tijdstip_melding) },
                  { label: 'Tijdstip aanwezig',   waarde: formaatDatum(cal.tijdstip_aanwezig) },
                  { label: 'Tijdstip afgerond',   waarde: formaatDatum(cal.tijdstip_afgerond) },
                  { label: 'Rijrichting',          waarde: cal.rijbaan_richting },
                  { label: 'Aantal stroken',       waarde: cal.aantal_stroken },
                  { label: 'Inspecteur RWS',       waarde: cal.naam_inspecteur_rws || '—' },
                ].map(({ label, waarde }) => (
                  <div key={label}>
                    <p className="text-slate-600 text-xs">{label}</p>
                    <p className="text-slate-300 text-sm font-medium">{waarde ?? '—'}</p>
                  </div>
                ))}
              </div>

              {/* Veiligheidschecklist */}
              <div className="flex gap-3 flex-wrap">
                {[
                  { label: 'PBM',      waarde: cal.checklist_pbm },
                  { label: 'Veilig',   waarde: cal.checklist_veilig },
                  { label: 'Stortbon', waarde: cal.checklist_stortbon },
                ].map(({ label, waarde }) => (
                  <span key={label}
                    className={`px-2.5 py-1 rounded-xl text-xs font-semibold border
                      ${waarde ? 'bg-status-succes/12 text-status-succes border-status-succes/25'
                               : 'bg-status-gevaar/12 text-status-gevaar border-status-gevaar/25'}`}>
                    {waarde ? '✓' : '✗'} {label}
                  </span>
                ))}
              </div>

              {/* Restschade */}
              {cal.restschade === 1 && (
                <div className="p-3 bg-yellow-500/8 border border-yellow-500/20 rounded-2xl">
                  <p className="text-yellow-400 text-xs font-semibold mb-1">⚠️ Restschade aanwezig</p>
                  <p className="text-slate-400 text-xs">{cal.restschade_omschrijving || '—'}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Laadskelet ────────────────────────────────────────────────────────────────

function SkeletKaart() {
  return (
    <div className="glas-kaart rounded-2xl p-4 flex items-center gap-3">
      <div className="w-12 h-12 rounded-2xl bg-white/5 animate-pulse shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 rounded-lg bg-white/5 animate-pulse w-3/4" />
        <div className="h-3 rounded-lg bg-white/5 animate-pulse w-1/2" />
      </div>
    </div>
  );
}

// ── Hoofd CalamiteitenLijst ───────────────────────────────────────────────────

export default function CalamiteitenLijst() {
  const { isAdmin } = useAuth();

  const [calamiteiten, setCalamiteiten] = useState([]);
  const [isLadend,     setIsLadend]     = useState(true);
  const [fout,         setFout]         = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [openId,       setOpenId]       = useState(null);

  const laad = useCallback(async () => {
    setIsLadend(true); setFout(null);
    try {
      const params = new URLSearchParams({ limit: 50 });
      if (filterStatus) params.set('status', filterStatus);
      const res = await api.get(`/api/calamiteiten?${params}`);
      setCalamiteiten(res.data ?? []);
    } catch (err) {
      setFout(err.message);
    } finally {
      setIsLadend(false);
    }
  }, [filterStatus]);

  useEffect(() => { laad(); }, [laad]);

  function toggleOpen(id) {
    setOpenId((prev) => (prev === id ? null : id));
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      className="flex flex-col gap-4"
    >
      {/* ── Kop ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">
            {isAdmin ? 'Alle Calamiteiten' : 'Mijn Dossiers'}
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {isAdmin ? 'Overzicht van alle geregistreerde calamiteiten' : 'Uw ingediende calamiteitendossiers'}
          </p>
        </div>
        {isAdmin && (
          <Link to="/admin"
            className="px-4 py-2.5 rounded-2xl text-sm font-semibold bg-white/6 border border-white/10 text-slate-300 hover:bg-white/10 transition-all shrink-0">
            Admin →
          </Link>
        )}
      </div>

      {/* ── Fout ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {fout && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="p-3 bg-status-gevaar/10 border border-status-gevaar/25 rounded-2xl text-status-gevaar text-sm">
            ⚠️ {fout}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Filters ──────────────────────────────────────────────────── */}
      <div className="flex gap-2">
        {[['', 'Alle'], ['Concept', 'Concept'], ['Ingezonden', 'Ingezonden']].map(([v, l]) => (
          <button key={v} type="button" onClick={() => setFilterStatus(v)}
            className={`flex-1 px-3 py-2 rounded-2xl text-xs font-semibold border transition-all
              ${filterStatus === v
                ? 'bg-accent border-accent/50 text-white'
                : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/8'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* ── Lijst ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        {isLadend ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletKaart key={i} />)
        ) : calamiteiten.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16 gap-4 text-center"
          >
            <span className="text-5xl opacity-20">📋</span>
            <p className="text-slate-400 font-medium">
              {filterStatus ? `Geen ${filterStatus.toLowerCase()} calamiteiten gevonden` : 'Nog geen calamiteiten geregistreerd'}
            </p>
            {!filterStatus && (
              <Link to="/wizard"
                className="mt-2 px-6 py-3 rounded-2xl font-semibold text-white text-sm"
                style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)', boxShadow: '0 4px 16px rgba(249,115,22,0.35)' }}>
                + Nieuwe calamiteit registreren
              </Link>
            )}
          </motion.div>
        ) : (
          <AnimatePresence>
            {calamiteiten.map((cal, idx) => (
              <motion.div
                key={cal.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
              >
                <CalamiteitKaart
                  cal={cal}
                  isOpen={openId === cal.id}
                  onToggle={() => toggleOpen(cal.id)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Teller onderaan */}
      {!isLadend && calamiteiten.length > 0 && (
        <p className="text-center text-slate-600 text-xs pb-4">
          {calamiteiten.length} dossier(s) geladen
        </p>
      )}
    </motion.div>
  );
}
