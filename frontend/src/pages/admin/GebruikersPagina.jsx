/**
 * GebruikersPagina.jsx — Fase 6
 * ==============================
 * Gebruikersbeheer voor Admins:
 *   - Overzichtstabel van alle medewerkers
 *   - Activeer / deactiveer medewerkers
 *   - Nieuwe medewerker aanmaken (modal)
 *   - CSV drag-and-drop import (POST /api/gebruikers/csv-import)
 *     Matcht op external_id — bestaande records worden bijgewerkt (UPSERT).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../utils/apiClient.js';

// ── Hulpcomponenten ────────────────────────────────────────────────────────────

function FoutBanner({ bericht, onWis }) {
  if (!bericht) return null;
  return (
    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="flex items-start gap-2 p-3 bg-status-gevaar/10 border border-status-gevaar/25 rounded-2xl">
      <span className="shrink-0 text-lg">⚠️</span>
      <p className="text-status-gevaar text-sm flex-1">{bericht}</p>
      {onWis && (
        <button type="button" onClick={onWis} className="text-status-gevaar/60 hover:text-status-gevaar text-lg leading-none">✕</button>
      )}
    </motion.div>
  );
}

function SuccesBanner({ bericht }) {
  if (!bericht) return null;
  return (
    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="flex items-center gap-2 p-3 bg-status-succes/10 border border-status-succes/25 rounded-2xl">
      <span className="text-status-succes text-lg">✓</span>
      <p className="text-status-succes text-sm">{bericht}</p>
    </motion.div>
  );
}

function LaadSpinner() {
  return (
    <div className="flex justify-center py-10">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        className="w-8 h-8 rounded-full border-2 border-accent/30 border-t-accent" />
    </div>
  );
}

// ── Rol-badge ──────────────────────────────────────────────────────────────────

function RolBadge({ rol }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border
      ${rol === 'Admin'
        ? 'bg-accent/15 text-accent border-accent/25'
        : 'bg-merk/20 text-slate-300 border-merk/30'}`}>
      {rol === 'Admin' ? '⭐' : '👤'} {rol}
    </span>
  );
}

// ── Nieuw-gebruiker modal ──────────────────────────────────────────────────────

function NieuweGebruikerModal({ onSluit, onGeslaagd }) {
  const [formulier, setFormulier] = useState({
    naam: '', wachtwoord: '', rol: 'Medewerker', external_id: '',
  });
  const [isBezig, setIsBezig] = useState(false);
  const [fout,    setFout]    = useState(null);
  const [toonWw,  setToonWw]  = useState(false);

  function veldWijzig(naam, waarde) {
    setFormulier((prev) => ({ ...prev, [naam]: waarde }));
  }

  async function opslaan() {
    if (!formulier.naam.trim())              { setFout('Naam is verplicht.'); return; }
    if (formulier.wachtwoord.length < 6)     { setFout('Wachtwoord is minimaal 6 tekens.'); return; }
    if (!['Admin', 'Medewerker'].includes(formulier.rol)) { setFout('Kies een geldige rol.'); return; }

    setIsBezig(true); setFout(null);
    try {
      const payload = {
        naam:       formulier.naam.trim(),
        wachtwoord: formulier.wachtwoord,
        rol:        formulier.rol,
      };
      // external_id alleen meesturen als het daadwerkelijk is ingevuld;
      // null sturen faalt de backend isString()-validator.
      const extId = formulier.external_id.trim();
      if (extId) payload.external_id = extId;

      await api.post('/api/gebruikers', payload);
      onGeslaagd('Medewerker toegevoegd.');
      onSluit();
    } catch (err) {
      // Toon de specifieke validatiemelding als die beschikbaar is
      const detail = Array.isArray(err.details) && err.details.length > 0
        ? err.details.map((d) => d.msg).join(' · ')
        : null;
      setFout(detail || err.message);
    }
    finally { setIsBezig(false); }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-6 bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onSluit()}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        className="w-full max-w-md glas-kaart rounded-3xl p-6 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-100">Medewerker toevoegen</h3>
          <button type="button" onClick={onSluit}
            className="w-8 h-8 rounded-full bg-white/6 flex items-center justify-center text-slate-400 hover:bg-white/10">
            ✕
          </button>
        </div>

        <AnimatePresence><FoutBanner bericht={fout} onWis={() => setFout(null)} /></AnimatePresence>

        <div className="flex flex-col gap-3">
          {/* Naam */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400">Naam <span className="text-accent">*</span></label>
            <input type="text" value={formulier.naam} onChange={(e) => veldWijzig('naam', e.target.value)}
              placeholder="Voor- en achternaam" className="invoerveld py-2.5 text-sm" />
          </div>

          {/* Wachtwoord */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400">Wachtwoord <span className="text-accent">*</span></label>
            <div className="relative">
              <input type={toonWw ? 'text' : 'password'} value={formulier.wachtwoord}
                onChange={(e) => veldWijzig('wachtwoord', e.target.value)}
                placeholder="Minimaal 6 tekens" className="invoerveld py-2.5 text-sm pr-12 w-full" />
              <button type="button" onClick={() => setToonWw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-sm">
                {toonWw ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* Rol */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400">Rol <span className="text-accent">*</span></label>
            <div className="flex gap-2">
              {['Medewerker', 'Admin'].map((r) => (
                <button key={r} type="button" onClick={() => veldWijzig('rol', r)}
                  className={`flex-1 py-2.5 rounded-2xl text-sm font-semibold border transition-all
                    ${formulier.rol === r ? 'bg-accent border-accent/50 text-white' : 'bg-white/5 border-white/10 text-slate-400'}`}>
                  {r === 'Admin' ? '⭐ Admin' : '👤 Medewerker'}
                </button>
              ))}
            </div>
          </div>

          {/* External ID (YourSoft SSO) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400">External ID (YourSoft)</label>
            <input type="text" value={formulier.external_id}
              onChange={(e) => veldWijzig('external_id', e.target.value)}
              placeholder="Optioneel — bijv. E001" className="invoerveld py-2.5 text-sm" />
          </div>
        </div>

        <div className="flex gap-2 mt-1">
          <button type="button" onClick={onSluit}
            className="flex-1 py-3 rounded-2xl bg-white/5 border border-white/10 text-slate-400 font-medium text-sm">
            Annuleren
          </button>
          <button type="button" onClick={opslaan} disabled={isBezig}
            className="flex-1 py-3 rounded-2xl font-semibold text-white text-sm disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)', boxShadow: '0 4px 16px rgba(249,115,22,0.35)' }}>
            {isBezig ? 'Opslaan…' : 'Toevoegen'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── CSV import zone ────────────────────────────────────────────────────────────

function CsvImportZone({ onGeslaagd }) {
  const [sleepmodus, setSleepmodus] = useState(false);
  const [isBezig,    setIsBezig]    = useState(false);
  const [fout,       setFout]       = useState(null);
  const [resultaat,  setResultaat]  = useState(null);
  const invoerRef = useRef(null);

  function handleDragOver(e) { e.preventDefault(); setSleepmodus(true); }
  function handleDragLeave()  { setSleepmodus(false); }
  function handleDrop(e) {
    e.preventDefault();
    setSleepmodus(false);
    const bestand = e.dataTransfer.files?.[0];
    if (bestand) verwerkCsv(bestand);
  }
  function handleInvoer(e) {
    const bestand = e.target.files?.[0];
    if (bestand) verwerkCsv(bestand);
    e.target.value = '';
  }

  async function verwerkCsv(bestand) {
    if (!bestand.name.endsWith('.csv')) {
      setFout('Alleen .csv bestanden zijn toegestaan.'); return;
    }
    setIsBezig(true); setFout(null); setResultaat(null);
    try {
      const fd = new FormData();
      fd.append('bestand', bestand);
      const res = await api.upload('/api/gebruikers/csv-import', fd);
      setResultaat(res);
      onGeslaagd?.(`CSV geïmporteerd: ${res.aangemaakt ?? 0} nieuw, ${res.bijgewerkt ?? 0} bijgewerkt`);
    } catch (err) { setFout(err.message); }
    finally { setIsBezig(false); }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">CSV Medewerker Import</p>

      {/* Drop zone */}
      <motion.div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => invoerRef.current?.click()}
        animate={{
          borderColor: sleepmodus ? 'rgba(249,115,22,0.6)' : 'rgba(255,255,255,0.12)',
          backgroundColor: sleepmodus ? 'rgba(249,115,22,0.06)' : 'rgba(255,255,255,0.02)',
        }}
        className="min-h-[100px] border-2 border-dashed rounded-3xl flex flex-col items-center justify-center
                   gap-3 cursor-pointer transition-all p-4"
      >
        {isBezig ? (
          <>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
              className="w-8 h-8 rounded-full border-2 border-accent/30 border-t-accent" />
            <p className="text-slate-400 text-sm">Importeren…</p>
          </>
        ) : (
          <>
            <span className="text-3xl">{sleepmodus ? '📂' : '📎'}</span>
            <div className="text-center">
              <p className="text-slate-300 text-sm font-medium">
                {sleepmodus ? 'Laat los om te importeren' : 'Sleep een CSV hier of klik om te bladeren'}
              </p>
              <p className="text-slate-600 text-xs mt-0.5">
                Kolommen: naam, external_id, wachtwoord, rol (Admin/Medewerker)
              </p>
            </div>
          </>
        )}
      </motion.div>

      <input ref={invoerRef} type="file" accept=".csv" onChange={handleInvoer} className="sr-only" />

      <AnimatePresence>
        {fout && <FoutBanner bericht={fout} onWis={() => setFout(null)} />}
        {resultaat && !fout && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="p-3 bg-status-succes/10 border border-status-succes/25 rounded-2xl">
            <p className="text-status-succes text-sm font-semibold mb-1">Import geslaagd!</p>
            <p className="text-slate-400 text-xs">
              Nieuw aangemaakt: <span className="text-slate-200 font-medium">{resultaat.aangemaakt ?? 0}</span>
              {' · '}Bijgewerkt: <span className="text-slate-200 font-medium">{resultaat.bijgewerkt ?? 0}</span>
              {resultaat.overgeslagen > 0 && (
                <> · Overgeslagen: <span className="text-yellow-400 font-medium">{resultaat.overgeslagen}</span></>
              )}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Hoofd GebruikersPagina ────────────────────────────────────────────────────

export default function GebruikersPagina() {
  const [gebruikers,   setGebruikers]   = useState([]);
  const [isLadend,     setIsLadend]     = useState(true);
  const [fout,         setFout]         = useState(null);
  const [succes,       setSucces]       = useState(null);
  const [toonModal,    setToonModal]    = useState(false);
  const [filterActief, setFilterActief] = useState('actief');
  const [filterRol,    setFilterRol]    = useState('');

  const laad = useCallback(async () => {
    setIsLadend(true);
    try {
      const res = await api.get('/api/gebruikers');
      setGebruikers(res.data ?? []);
    } catch (err) { setFout(err.message); }
    finally { setIsLadend(false); }
  }, []);

  useEffect(() => { laad(); }, [laad]);

  async function wisselActief(id, huidigActief) {
    const actie = huidigActief ? 'deactiveren' : 'activeren';
    if (!confirm(`Medewerker ${actie}?`)) return;
    try {
      if (huidigActief) {
        await api.delete(`/api/gebruikers/${id}`);
      } else {
        await api.patch(`/api/gebruikers/${id}`, { actief: true });
      }
      setSucces(`Medewerker ${huidigActief ? 'gedeactiveerd' : 'geactiveerd'}.`);
      laad();
      setTimeout(() => setSucces(null), 3000);
    } catch (err) { setFout(err.message); }
  }

  function berichtNaImport(bericht) {
    setSucces(bericht);
    laad();
    setTimeout(() => setSucces(null), 5000);
  }

  // Filter client-side
  const gefilterd = gebruikers.filter((g) => {
    const actiefOk = filterActief === '' || (filterActief === 'actief' ? g.actief : !g.actief);
    const rolOk    = filterRol === '' || g.rol === filterRol;
    return actiefOk && rolOk;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      className="flex flex-col gap-5"
    >
      {/* Paginakop */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Medewerkers</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Beheer accounts en importeer via CSV
          </p>
        </div>
        <motion.button type="button" onClick={() => setToonModal(true)} whileTap={{ scale: 0.97 }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl font-semibold text-sm text-white shrink-0"
          style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)', boxShadow: '0 4px 16px rgba(249,115,22,0.35)' }}>
          + Toevoegen
        </motion.button>
      </div>

      {/* Berichten */}
      <AnimatePresence>
        {fout   && <FoutBanner bericht={fout} onWis={() => setFout(null)} />}
        {succes  && <SuccesBanner bericht={succes} />}
      </AnimatePresence>

      {/* ── Statistieken ────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Totaal',     waarde: gebruikers.length,                            kleur: 'bg-merk/20',           icon: '👥' },
          { label: 'Actief',     waarde: gebruikers.filter((g) => g.actief).length,    kleur: 'bg-status-succes/20',  icon: '✅' },
          { label: 'Admins',     waarde: gebruikers.filter((g) => g.rol === 'Admin').length, kleur: 'bg-accent/20',  icon: '⭐' },
        ].map(({ label, waarde, kleur, icon }) => (
          <div key={label} className="glas-kaart rounded-2xl p-3 flex items-center gap-2">
            <div className={`w-9 h-9 rounded-xl ${kleur} flex items-center justify-center text-lg shrink-0`}>{icon}</div>
            <div>
              {isLadend
                ? <div className="h-5 w-8 rounded-lg bg-white/8 animate-pulse" />
                : <p className="text-xl font-bold text-slate-100 leading-none">{waarde}</p>
              }
              <p className="text-slate-500 text-xs mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filters ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {/* Status filter */}
        {[['actief', 'Actief'], ['inactief', 'Inactief'], ['', 'Alle']].map(([v, l]) => (
          <button key={v} type="button" onClick={() => setFilterActief(v)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all
              ${filterActief === v ? 'bg-accent border-accent/50 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/8'}`}>
            {l}
          </button>
        ))}
        <div className="w-px bg-white/10 self-stretch mx-1" />
        {/* Rol filter */}
        {[['', 'Alle rollen'], ['Admin', 'Admin'], ['Medewerker', 'Medewerker']].map(([v, l]) => (
          <button key={v || 'alle'} type="button" onClick={() => setFilterRol(v)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all
              ${filterRol === v ? 'bg-merk border-merk/50 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/8'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* ── Gebruikerstabel ─────────────────────────────────────────── */}
      {isLadend ? <LaadSpinner /> : (
        <div className="glas-kaart rounded-2xl overflow-hidden">
          {gefilterd.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-4xl mb-3 opacity-25">👥</p>
              <p className="text-slate-500 text-sm">Geen medewerkers gevonden</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8">
                  {['Naam', 'Rol', 'External ID', 'Status', 'Lid sinds', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gefilterd.map((g, idx) => (
                  <motion.tr key={g.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.03 }}
                    className="border-b border-white/4 hover:bg-white/3 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        {/* Avatar-initialen */}
                        <div className="w-8 h-8 rounded-full bg-merk/30 border border-merk/40 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0">
                          {g.naam?.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-slate-200 font-medium">{g.naam}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5"><RolBadge rol={g.rol} /></td>
                    <td className="px-4 py-3.5 text-slate-500 font-mono text-xs">{g.external_id || '—'}</td>
                    <td className="px-4 py-3.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border
                        ${g.actief ? 'bg-status-succes/15 text-status-succes border-status-succes/25'
                                   : 'bg-white/6 text-slate-500 border-white/10'}`}>
                        {g.actief ? 'Actief' : 'Inactief'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 text-xs">
                      {g.aangemaakt_op
                        ? new Date(g.aangemaakt_op).toLocaleDateString('nl-NL')
                        : '—'}
                    </td>
                    <td className="px-4 py-3.5">
                      <button type="button"
                        onClick={() => wisselActief(g.id, g.actief)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all
                          ${g.actief
                            ? 'bg-status-gevaar/10 border-status-gevaar/20 text-status-gevaar hover:bg-status-gevaar/20'
                            : 'bg-status-succes/10 border-status-succes/20 text-status-succes hover:bg-status-succes/20'}`}>
                        {g.actief ? 'Deactiveer' : 'Activeer'}
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── CSV Import ───────────────────────────────────────────────── */}
      <div className="glas-kaart rounded-2xl p-5">
        <CsvImportZone onGeslaagd={berichtNaImport} />
      </div>

      {/* ── Nieuw-modal ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {toonModal && (
          <NieuweGebruikerModal
            onSluit={() => setToonModal(false)}
            onGeslaagd={(msg) => {
              setSucces(msg);
              laad();
              setTimeout(() => setSucces(null), 3000);
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
