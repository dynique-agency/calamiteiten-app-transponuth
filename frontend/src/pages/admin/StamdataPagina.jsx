/**
 * StamdataPagina.jsx — Fase 6
 * ============================
 * Stamdata-beheerpagina voor Admins, met drie tabbladen:
 *   1. Materieel    — CRUD van materieel-items
 *   2. Tarieven     — Beheer van Configuratie-sleutels (weekendtoeslagen)
 *   3. CROW-regels  — Beheer van rekenregels per scenario
 *
 * Tab-animaties via Framer Motion layoutId.
 * Alle wijzigingen worden audit-gelogd op de backend.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../utils/apiClient.js';

// ── Constanten ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'materieel',  label: 'Materieel',    emoji: '🚛' },
  { id: 'tarieven',   label: 'Tarieven',     emoji: '💶' },
  { id: 'crow',       label: 'CROW-regels',  emoji: '🚦' },
];

// ── Hulpcomponenten ────────────────────────────────────────────────────────────

/** Gestandaardiseerde foutmelding. */
function FoutBanner({ bericht, onWis }) {
  if (!bericht) return null;
  return (
    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="flex items-start gap-2 p-3 bg-status-gevaar/10 border border-status-gevaar/25 rounded-2xl">
      <span className="text-lg shrink-0">⚠️</span>
      <p className="text-status-gevaar text-sm flex-1">{bericht}</p>
      {onWis && (
        <button type="button" onClick={onWis} className="text-status-gevaar/60 hover:text-status-gevaar text-lg leading-none">✕</button>
      )}
    </motion.div>
  );
}

/** Succesbanner na opslaan. */
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

/** Laad-spinner gecentreerd. */
function LaadSpinner() {
  return (
    <div className="flex justify-center py-10">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        className="w-8 h-8 rounded-full border-2 border-accent/30 border-t-accent" />
    </div>
  );
}

/** Lege staat voor een tabel. */
function LegeTabToestand({ tekst }) {
  return (
    <div className="py-12 text-center">
      <p className="text-4xl mb-3 opacity-25">📭</p>
      <p className="text-slate-500 text-sm">{tekst}</p>
    </div>
  );
}

/** Generieke invoerveld-wrapper. */
function InvoerVeld({ label, children, verplicht }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-slate-400">
        {label}{verplicht && <span className="text-accent ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

// ── CRUD-modaal ────────────────────────────────────────────────────────────────

/**
 * Generieke modal voor toevoegen/bewerken.
 * Accepteert een `velden`-array die beschrijft welke inputs getoond worden.
 */
function BeheerModal({ titel, velden, waarden, onWijzig, onOpslaan, onSluit, isBezig, fout }) {
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
        {/* Kop */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-100">{titel}</h3>
          <button type="button" onClick={onSluit}
            className="w-8 h-8 rounded-full bg-white/6 flex items-center justify-center text-slate-400 hover:bg-white/10 transition-colors">
            ✕
          </button>
        </div>

        <AnimatePresence><FoutBanner bericht={fout} /></AnimatePresence>

        {/* Dynamische velden */}
        <div className="flex flex-col gap-3">
          {velden.map((v) => (
            <InvoerVeld key={v.naam} label={v.label} verplicht={v.verplicht}>
              {v.type === 'select' ? (
                <select value={waarden[v.naam] ?? ''} onChange={(e) => onWijzig(v.naam, e.target.value)}
                  className="invoerveld py-2.5 text-sm">
                  {v.opties.map((o) => (
                    <option key={o.waarde} value={o.waarde}>{o.label}</option>
                  ))}
                </select>
              ) : v.type === 'textarea' ? (
                <textarea rows={2} value={waarden[v.naam] ?? ''}
                  onChange={(e) => onWijzig(v.naam, e.target.value)}
                  placeholder={v.placeholder ?? ''} className="invoerveld resize-none py-2.5 text-sm" />
              ) : (
                <input type={v.type ?? 'text'} value={waarden[v.naam] ?? ''}
                  onChange={(e) => onWijzig(v.naam, e.target.value)}
                  placeholder={v.placeholder ?? ''} className="invoerveld py-2.5 text-sm"
                  step={v.stap} min={v.min} />
              )}
            </InvoerVeld>
          ))}
        </div>

        {/* Knoppen */}
        <div className="flex gap-2 mt-1">
          <button type="button" onClick={onSluit}
            className="flex-1 py-3 rounded-2xl bg-white/5 border border-white/10 text-slate-400 font-medium text-sm hover:bg-white/8 transition-all">
            Annuleren
          </button>
          <button type="button" onClick={onOpslaan} disabled={isBezig}
            className="flex-1 py-3 rounded-2xl font-semibold text-white text-sm disabled:opacity-50 transition-all"
            style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)', boxShadow: '0 4px 16px rgba(249,115,22,0.35)' }}>
            {isBezig ? 'Opslaan…' : 'Opslaan'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Tab 1: Materieel ──────────────────────────────────────────────────────────

function MaterieelTab() {
  const [lijst,    setLijst]   = useState([]);
  const [isLadend, setIsLadend]= useState(true);
  const [fout,     setFout]    = useState(null);
  const [succes,   setSucces]  = useState(null);
  const [modal,    setModal]   = useState(null); // null | { modus: 'nieuw'|'bewerk', item }
  const [isBezig,  setIsBezig] = useState(false);
  const [formulier,setFormulier]= useState({});

  const laad = useCallback(async () => {
    setIsLadend(true);
    try {
      const res = await api.get('/api/materieel');
      setLijst(res.data ?? []);
    } catch (err) { setFout(err.message); }
    finally { setIsLadend(false); }
  }, []);

  useEffect(() => { laad(); }, [laad]);

  function openNieuw() {
    setFormulier({ naam: '', eenheid: 'uur', basistarief: '0', uurtarief: '0', actief: '1' });
    setModal({ modus: 'nieuw' });
    setFout(null);
  }

  function openBewerk(item) {
    setFormulier({ ...item, actief: String(item.actief) });
    setModal({ modus: 'bewerk', item });
    setFout(null);
  }

  function veldWijzig(naam, waarde) {
    setFormulier((prev) => ({ ...prev, [naam]: waarde }));
  }

  async function opslaan() {
    setIsBezig(true); setFout(null);
    try {
      const body = {
        naam:        formulier.naam,
        eenheid:     formulier.eenheid,
        basistarief: Number(formulier.basistarief),
        uurtarief:   Number(formulier.uurtarief),
        actief:      formulier.actief === '1' ? 1 : 0,
      };
      if (modal.modus === 'nieuw') {
        await api.post('/api/materieel', body);
        setSucces('Materieel toegevoegd.');
      } else {
        await api.patch(`/api/materieel/${modal.item.id}`, body);
        setSucces('Materieel bijgewerkt.');
      }
      setModal(null);
      laad();
      setTimeout(() => setSucces(null), 3000);
    } catch (err) { setFout(err.message); }
    finally { setIsBezig(false); }
  }

  async function deactiveer(id) {
    if (!confirm('Materieel deactiveren?')) return;
    try {
      await api.delete(`/api/materieel/${id}`);
      setSucces('Materieel gedeactiveerd.');
      laad();
      setTimeout(() => setSucces(null), 3000);
    } catch (err) { setFout(err.message); }
  }

  const velden = [
    { naam: 'naam',        label: 'Naam',           verplicht: true, placeholder: 'bijv. Pijlwagen' },
    { naam: 'eenheid',     label: 'Eenheid',        type: 'select',
      opties: [{ waarde:'uur', label:'Uur' }, { waarde:'stuk', label:'Stuk' }, { waarde:'dag', label:'Dag' }] },
    { naam: 'basistarief', label: 'Basistarief (€)', type: 'number', stap: '0.01', min: '0', placeholder: '0.00' },
    { naam: 'uurtarief',   label: 'Uurtarief (€)',   type: 'number', stap: '0.01', min: '0', placeholder: '0.00' },
    { naam: 'actief',      label: 'Status', type: 'select',
      opties: [{ waarde: '1', label: 'Actief' }, { waarde: '0', label: 'Inactief' }] },
  ];

  return (
    <div className="flex flex-col gap-4">
      <AnimatePresence>
        <FoutBanner   bericht={fout} onWis={() => setFout(null)} />
        <SuccesBanner bericht={succes} />
      </AnimatePresence>

      <button type="button" onClick={openNieuw}
        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl font-semibold text-sm text-white self-start"
        style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)', boxShadow: '0 4px 16px rgba(249,115,22,0.3)' }}>
        + Materieel toevoegen
      </button>

      {isLadend ? <LaadSpinner /> : lijst.length === 0 ? (
        <LegeTabToestand tekst="Nog geen materieel geconfigureerd" />
      ) : (
        <div className="glas-kaart rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8">
                {['Naam','Eenheid','Basistarief','Uurtarief','Status',''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lijst.map((m) => (
                <tr key={m.id} className="border-b border-white/4 hover:bg-white/3 transition-colors">
                  <td className="px-4 py-3.5 text-slate-200 font-medium">{m.naam}</td>
                  <td className="px-4 py-3.5 text-slate-400">{m.eenheid}</td>
                  <td className="px-4 py-3.5 text-slate-300">€ {Number(m.basistarief).toFixed(2)}</td>
                  <td className="px-4 py-3.5 text-slate-300">€ {Number(m.uurtarief).toFixed(2)}</td>
                  <td className="px-4 py-3.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border
                      ${m.actief ? 'bg-status-succes/15 text-status-succes border-status-succes/25'
                                 : 'bg-white/6 text-slate-500 border-white/10'}`}>
                      {m.actief ? 'Actief' : 'Inactief'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex gap-2 justify-end">
                      <button type="button" onClick={() => openBewerk(m)}
                        className="px-3 py-1.5 rounded-xl bg-white/6 border border-white/10 text-slate-300 text-xs hover:bg-white/10 transition-all">
                        Bewerk
                      </button>
                      {m.actief === 1 && (
                        <button type="button" onClick={() => deactiveer(m.id)}
                          className="px-3 py-1.5 rounded-xl bg-status-gevaar/10 border border-status-gevaar/20 text-status-gevaar text-xs hover:bg-status-gevaar/20 transition-all">
                          Deactiveer
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AnimatePresence>
        {modal && (
          <BeheerModal
            titel={modal.modus === 'nieuw' ? 'Materieel toevoegen' : 'Materieel bewerken'}
            velden={velden} waarden={formulier} onWijzig={veldWijzig}
            onOpslaan={opslaan} onSluit={() => setModal(null)}
            isBezig={isBezig} fout={modal.modus && fout ? fout : null}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Tab 2: Tarieven (Configuratie) ────────────────────────────────────────────

function TarievenTab() {
  const [lijst,    setLijst]    = useState([]);
  const [isLadend, setIsLadend] = useState(true);
  const [fout,     setFout]     = useState(null);
  const [succes,   setSucces]   = useState(null);
  const [modal,    setModal]    = useState(null);
  const [isBezig,  setIsBezig]  = useState(false);
  const [formulier,setFormulier]= useState({});

  const laad = useCallback(async () => {
    setIsLadend(true);
    try {
      const res = await api.get('/api/configuratie');
      setLijst(res.data ?? []);
    } catch (err) { setFout(err.message); }
    finally { setIsLadend(false); }
  }, []);

  useEffect(() => { laad(); }, [laad]);

  function openBewerk(item) {
    setFormulier({ sleutel: item.sleutel, waarde: item.waarde, omschrijving: item.omschrijving ?? '' });
    setModal({ item }); setFout(null);
  }

  function openNieuw() {
    setFormulier({ sleutel: '', waarde: '', omschrijving: '' });
    setModal({ item: null }); setFout(null);
  }

  function veldWijzig(naam, waarde) {
    setFormulier((prev) => ({ ...prev, [naam]: waarde }));
  }

  async function opslaan() {
    setIsBezig(true); setFout(null);
    try {
      await api.put(`/api/configuratie/${formulier.sleutel}`, {
        waarde: formulier.waarde, omschrijving: formulier.omschrijving,
      });
      setSucces('Tarief opgeslagen.');
      setModal(null); laad();
      setTimeout(() => setSucces(null), 3000);
    } catch (err) { setFout(err.message); }
    finally { setIsBezig(false); }
  }

  const velden = [
    { naam: 'sleutel',     label: 'Sleutel (config-naam)', verplicht: true,
      placeholder: 'bijv. zaterdagtoeslag_uurtarief' },
    { naam: 'waarde',      label: 'Waarde',  verplicht: true, placeholder: 'bijv. 18.75' },
    { naam: 'omschrijving',label: 'Omschrijving', type: 'textarea', placeholder: 'Korte beschrijving…' },
  ];

  return (
    <div className="flex flex-col gap-4">
      <AnimatePresence>
        <FoutBanner bericht={fout} onWis={() => setFout(null)} />
        <SuccesBanner bericht={succes} />
      </AnimatePresence>

      <div className="flex items-center justify-between">
        <p className="text-slate-500 text-sm">
          Tarieven gelden direct voor nieuwe calamiteiten. Historische snapshots wijzigen niet.
        </p>
        <button type="button" onClick={openNieuw}
          className="flex items-center gap-2 px-4 py-2 rounded-2xl font-semibold text-sm text-white shrink-0"
          style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)', boxShadow: '0 4px 16px rgba(249,115,22,0.3)' }}>
          + Nieuw
        </button>
      </div>

      {isLadend ? <LaadSpinner /> : lijst.length === 0 ? (
        <LegeTabToestand tekst="Geen configuratie-sleutels gevonden" />
      ) : (
        <div className="flex flex-col gap-3">
          {lijst.map((item) => (
            <div key={item.sleutel}
              className="glas-kaart rounded-2xl p-4 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-slate-200 font-semibold text-sm font-mono">{item.sleutel}</p>
                <p className="text-slate-500 text-xs mt-0.5 truncate">{item.omschrijving || '—'}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xl font-bold text-accent">€ {item.waarde}</span>
                <button type="button" onClick={() => openBewerk(item)}
                  className="px-3 py-1.5 rounded-xl bg-white/6 border border-white/10 text-slate-300 text-xs hover:bg-white/10 transition-all">
                  Bewerk
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {modal !== null && (
          <BeheerModal
            titel={modal.item ? 'Tarief bewerken' : 'Tarief toevoegen'}
            velden={modal.item ? velden.filter((v) => v.naam !== 'sleutel').concat([{ naam: 'sleutel', label: 'Sleutel', verplicht: true }]) : velden}
            waarden={formulier} onWijzig={veldWijzig}
            onOpslaan={opslaan} onSluit={() => setModal(null)}
            isBezig={isBezig} fout={null}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Tab 3: CROW Rekenregels ───────────────────────────────────────────────────

function CrowRegelTab() {
  const [lijst,     setLijst]     = useState([]);
  const [isLadend,  setIsLadend]  = useState(true);
  const [fout,      setFout]      = useState(null);
  const [succes,    setSucces]    = useState(null);
  const [modal,     setModal]     = useState(null);
  const [isBezig,   setIsBezig]   = useState(false);
  const [formulier, setFormulier] = useState({});
  const [actief,    setActief]    = useState('beide'); // '1' | '2' | 'beide'

  const laad = useCallback(async () => {
    setIsLadend(true);
    try {
      const res = await api.get('/api/rekenregels');
      setLijst(res.data ?? []);
    } catch (err) { setFout(err.message); }
    finally { setIsLadend(false); }
  }, []);

  useEffect(() => { laad(); }, [laad]);

  function openNieuw() {
    setFormulier({ object_naam: '', scenario_stroken: '1', offset_hmp: '0', volgorde: '1' });
    setModal({ modus: 'nieuw' }); setFout(null);
  }

  function openBewerk(item) {
    setFormulier({ ...item, scenario_stroken: String(item.scenario_stroken), offset_hmp: String(item.offset_hmp), volgorde: String(item.volgorde ?? 1) });
    setModal({ modus: 'bewerk', item }); setFout(null);
  }

  function veldWijzig(naam, waarde) {
    setFormulier((prev) => ({ ...prev, [naam]: waarde }));
  }

  async function opslaan() {
    setIsBezig(true); setFout(null);
    try {
      const body = {
        object_naam:      formulier.object_naam,
        scenario_stroken: Number(formulier.scenario_stroken),
        offset_hmp:       Number(formulier.offset_hmp),
        volgorde:         Number(formulier.volgorde),
      };
      if (modal.modus === 'nieuw') {
        await api.post('/api/rekenregels', body);
        setSucces('Rekenregel toegevoegd.');
      } else {
        await api.patch(`/api/rekenregels/${modal.item.id}`, body);
        setSucces('Rekenregel bijgewerkt.');
      }
      setModal(null); laad();
      setTimeout(() => setSucces(null), 3000);
    } catch (err) { setFout(err.message); }
    finally { setIsBezig(false); }
  }

  async function verwijder(id) {
    if (!confirm('Rekenregel definitief verwijderen?')) return;
    try {
      await api.delete(`/api/rekenregels/${id}`);
      setSucces('Rekenregel verwijderd.');
      laad();
      setTimeout(() => setSucces(null), 3000);
    } catch (err) { setFout(err.message); }
  }

  const gefilterdeLijst = actief === 'beide'
    ? lijst
    : lijst.filter((r) => String(r.scenario_stroken) === actief);

  const velden = [
    { naam: 'object_naam',      label: 'Object naam', verplicht: true, placeholder: 'bijv. Waarschuwing 1' },
    { naam: 'scenario_stroken', label: 'Scenario stroken', type: 'select',
      opties: [{ waarde: '1', label: '1 strook' }, { waarde: '2', label: '2 stroken' }] },
    { naam: 'offset_hmp',       label: 'Offset HMP (m)', type: 'number', stap: '1', placeholder: '0' },
    { naam: 'volgorde',         label: 'Volgorde',       type: 'number', stap: '1', min: '1', placeholder: '1' },
  ];

  return (
    <div className="flex flex-col gap-4">
      <AnimatePresence>
        <FoutBanner bericht={fout} onWis={() => setFout(null)} />
        <SuccesBanner bericht={succes} />
      </AnimatePresence>

      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* Scenario-filter */}
        <div className="flex gap-1">
          {[['beide', 'Alle'], ['1', '1 Strook'], ['2', '2 Stroken']].map(([v, l]) => (
            <button key={v} type="button" onClick={() => setActief(v)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all
                ${actief === v ? 'bg-accent border-accent/50 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/8'}`}>
              {l}
            </button>
          ))}
        </div>
        <button type="button" onClick={openNieuw}
          className="flex items-center gap-2 px-4 py-2 rounded-2xl font-semibold text-sm text-white"
          style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)', boxShadow: '0 4px 16px rgba(249,115,22,0.3)' }}>
          + Rekenregel toevoegen
        </button>
      </div>

      {isLadend ? <LaadSpinner /> : gefilterdeLijst.length === 0 ? (
        <LegeTabToestand tekst="Geen rekenregels gevonden" />
      ) : (
        <div className="glas-kaart rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8">
                {['#','Object naam','Scenario','Offset HMP','Volgorde',''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gefilterdeLijst.map((r) => (
                <tr key={r.id} className="border-b border-white/4 hover:bg-white/3 transition-colors">
                  <td className="px-4 py-3.5 text-slate-600 font-mono text-xs">{r.id}</td>
                  <td className="px-4 py-3.5 text-slate-200 font-medium">{r.object_naam}</td>
                  <td className="px-4 py-3.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border
                      ${r.scenario_stroken === 1
                        ? 'bg-merk/20 text-slate-300 border-merk/30'
                        : 'bg-accent/15 text-accent border-accent/25'}`}>
                      {r.scenario_stroken} strook/stroken
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-slate-300 font-mono">{r.offset_hmp} m</td>
                  <td className="px-4 py-3.5 text-slate-400">{r.volgorde ?? '—'}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex gap-2 justify-end">
                      <button type="button" onClick={() => openBewerk(r)}
                        title="Rekenregel bewerken"
                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/6 border border-white/10 text-slate-300 hover:bg-accent/15 hover:border-accent/30 hover:text-accent transition-all"
                        aria-label="Bewerk rekenregel">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                        </svg>
                      </button>
                      <button type="button" onClick={() => verwijder(r.id)}
                        title="Rekenregel verwijderen"
                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-status-gevaar/10 border border-status-gevaar/20 text-status-gevaar hover:bg-status-gevaar/20 transition-all"
                        aria-label="Verwijder rekenregel">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AnimatePresence>
        {modal && (
          <BeheerModal
            titel={modal.modus === 'nieuw' ? 'Rekenregel toevoegen' : 'Rekenregel bewerken'}
            velden={velden} waarden={formulier} onWijzig={veldWijzig}
            onOpslaan={opslaan} onSluit={() => setModal(null)}
            isBezig={isBezig} fout={null}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Hoofd StamdataPagina ──────────────────────────────────────────────────────

export default function StamdataPagina() {
  const [actiefTab, setActiefTab] = useState('materieel');

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      className="flex flex-col gap-5"
    >
      {/* Paginakop */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Stamdata Beheer</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Materieel, tarieven en CROW-rekenregels
        </p>
      </div>

      {/* ── Tab-balk ──────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 glas-kaart rounded-2xl">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiefTab(tab.id)}
            className="relative flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5
                       rounded-xl text-sm font-semibold transition-colors duration-200 select-none"
            style={{ color: actiefTab === tab.id ? '#fff' : undefined }}
          >
            {/* Actieve indicator (Framer Motion layoutId voor vloeiende sliding) */}
            {actiefTab === tab.id && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute inset-0 rounded-xl"
                style={{ background: 'linear-gradient(135deg, rgba(249,115,22,0.3), rgba(249,115,22,0.15))', border: '1px solid rgba(249,115,22,0.3)' }}
                transition={{ type: 'spring', stiffness: 450, damping: 35 }}
              />
            )}
            <span className="relative z-10 text-base">{tab.emoji}</span>
            <span className={`relative z-10 hidden sm:inline ${actiefTab === tab.id ? 'text-slate-100' : 'text-slate-500'}`}>
              {tab.label}
            </span>
          </button>
        ))}
      </div>

      {/* ── Tab-inhoud ────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={actiefTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
        >
          {actiefTab === 'materieel' && <MaterieelTab />}
          {actiefTab === 'tarieven'  && <TarievenTab />}
          {actiefTab === 'crow'      && <CrowRegelTab />}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
