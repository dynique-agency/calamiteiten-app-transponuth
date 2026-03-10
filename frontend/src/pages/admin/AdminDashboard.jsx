/**
 * AdminDashboard.jsx — Fase 6
 * ===========================
 * Hoofd-beheerpagina voor Admins:
 *   - Statistieken-koppen (totaal / concept / ingezonden)
 *   - Filters op status, rijksweg en datum
 *   - Premium data-tabel van alle calamiteiten
 *   - Slide-over correctiepaneel per calamiteit
 *   - Excel-kostenoverzicht export
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api, { APIFout } from '../../utils/apiClient.js';

// ── Hulpfuncties ──────────────────────────────────────────────────────────────

/** Formatteert een ISO-datum als leesbare Nederlandse string. */
function formaatDatum(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('nl-NL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/** Formatteert alleen de datumcomponent. */
function formaatDatumKort(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Formateert een geldbedrag naar euros. */
function formaatGeld(bedrag) {
  if (bedrag == null) return '—';
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(bedrag);
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const stijlen = {
    Concept:    'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
    Ingezonden: 'bg-status-succes/15 text-status-succes border-status-succes/25',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${stijlen[status] ?? 'bg-white/10 text-slate-400 border-white/15'}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {status}
    </span>
  );
}

// ── Skeletrij voor laadstatus ─────────────────────────────────────────────────

function SkeletRij() {
  return (
    <tr className="border-b border-white/4">
      {[1,2,3,4,5,6].map((i) => (
        <td key={i} className="px-4 py-3.5">
          <div className="h-4 rounded-lg bg-white/5 animate-pulse" style={{ width: `${50 + (i * 13) % 40}%` }} />
        </td>
      ))}
    </tr>
  );
}

// ── Lege-staat component ──────────────────────────────────────────────────────

function LegeStaat({ gefilterd }) {
  return (
    <tr>
      <td colSpan={7} className="py-16 text-center">
        <div className="flex flex-col items-center gap-3">
          <span className="text-4xl opacity-30">{gefilterd ? '🔍' : '📋'}</span>
          <p className="text-slate-400 font-medium">
            {gefilterd ? 'Geen calamiteiten gevonden voor deze filters' : 'Nog geen calamiteiten geregistreerd'}
          </p>
          {!gefilterd && (
            <p className="text-slate-600 text-sm">Gebruik de wizard om een calamiteit te registreren</p>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Stat-kaart ────────────────────────────────────────────────────────────────

function StatKaart({ label, waarde, icon, kleur, isLadend }) {
  return (
    <div className="glas-kaart rounded-2xl p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl ${kleur} flex items-center justify-center text-xl shrink-0`}>
        {icon}
      </div>
      <div>
        {isLadend
          ? <div className="h-7 w-12 rounded-lg bg-white/8 animate-pulse mb-1" />
          : <p className="text-2xl font-bold text-slate-100 leading-none">{waarde}</p>
        }
        <p className="text-slate-500 text-xs mt-1">{label}</p>
      </div>
    </div>
  );
}

// ── Correctie-slide-over ──────────────────────────────────────────────────────

/** Hulpfunctie: ISO-string omzetten naar datetime-local input-waarde. */
function isoNaarDatetimeLocal(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toISOString().slice(0, 16);
  } catch { return ''; }
}

function CorrectiePanel({ calamiteitId, onSluit, onBijgewerkt }) {
  const [detail,       setDetail]       = useState(null);
  const [isLadend,     setIsLadend]     = useState(true);
  const [isBewaren,    setIsBewaren]    = useState(false);
  const [isHerber,     setIsHerber]     = useState(false);
  const [fout,         setFout]         = useState(null);
  const [bewerkVeld,   setBewerkVeld]   = useState(null); // 'status' | null
  const [nieuweStatus, setNieuweStatus] = useState('');
  // Bewerkformulier staat
  const [bewerkModus,  setBewerkModus]  = useState(false);
  const [bewerkData,   setBewerkData]   = useState({});
  const [klanten,      setKlanten]      = useState([]);

  // Data ophalen bij openen
  useEffect(() => {
    if (!calamiteitId) return;
    setIsLadend(true);
    setFout(null);
    setBewerkModus(false);
    api.get(`/api/calamiteiten/${calamiteitId}`)
      .then((res) => {
        const d = res.data ?? res;
        setDetail(d);
        setNieuweStatus(d.status);
      })
      .catch((err) => setFout(err.message))
      .finally(() => setIsLadend(false));
  }, [calamiteitId]);

  // Klanten laden zodra bewerkModus opent
  useEffect(() => {
    if (!bewerkModus || klanten.length > 0) return;
    api.get('/api/klanten')
      .then((res) => setKlanten(res.data ?? []))
      .catch(() => {});
  }, [bewerkModus, klanten.length]);

  // Bewerkformulier initialiseren vanuit huidig detail
  function openBewerkModus() {
    if (!detail) return;
    setBewerkData({
      tijdstip_melding:    isoNaarDatetimeLocal(detail.tijdstip_melding),
      tijdstip_aanwezig:   isoNaarDatetimeLocal(detail.tijdstip_aanwezig),
      tijdstip_afgerond:   isoNaarDatetimeLocal(detail.tijdstip_afgerond),
      naam_inspecteur_rws: detail.naam_inspecteur_rws ?? '',
      klant_id:            detail.klant_id ?? '',
    });
    setBewerkModus(true);
    setBewerkVeld(null);
    setFout(null);
  }

  // Bewerkformulier veld wijzigen
  function bewerkVeldWijzig(naam, waarde) {
    setBewerkData((prev) => ({ ...prev, [naam]: waarde }));
  }

  // Opslaan via PUT /herbereken met gecorrigeerde tijden
  async function opslaanEnHerbereken() {
    setIsBewaren(true); setFout(null);
    try {
      const payload = {
        tijdstip_melding:    bewerkData.tijdstip_melding   || null,
        tijdstip_aanwezig:   bewerkData.tijdstip_aanwezig  || null,
        tijdstip_afgerond:   bewerkData.tijdstip_afgerond  || null,
        naam_inspecteur_rws: bewerkData.naam_inspecteur_rws || null,
        klant_id:            bewerkData.klant_id ? parseInt(bewerkData.klant_id) : null,
      };
      await api.put(`/api/calamiteiten/${calamiteitId}/herbereken`, payload);
      // Herlaad de details
      const res = await api.get(`/api/calamiteiten/${calamiteitId}`);
      const d = res.data ?? res;
      setDetail(d);
      setNieuweStatus(d.status);
      setBewerkModus(false);
      onBijgewerkt?.();
    } catch (err) { setFout(err.message); }
    finally { setIsBewaren(false); }
  }

  // Status wijzigen
  async function wijzigStatus() {
    if (!detail || nieuweStatus === detail.status) return;
    setIsBewaren(true); setFout(null);
    try {
      await api.patch(`/api/calamiteiten/${calamiteitId}/status`, { status: nieuweStatus });
      setDetail((prev) => ({ ...prev, status: nieuweStatus }));
      setBewerkVeld(null);
      onBijgewerkt?.();
    } catch (err) { setFout(err.message); }
    finally { setIsBewaren(false); }
  }

  // Volledige herberekening (zonder aanpassing — herbereken bestaande data)
  async function herbereken() {
    setIsHerber(true); setFout(null);
    try {
      await api.put(`/api/calamiteiten/${calamiteitId}/herbereken`, {});
      const res = await api.get(`/api/calamiteiten/${calamiteitId}`);
      setDetail(res.data ?? res);
      onBijgewerkt?.();
    } catch (err) { setFout(err.message); }
    finally { setIsHerber(false); }
  }

  // PDF downloaden
  async function downloadPdf() {
    try {
      const blob = await api.getBlob(`/api/export/pdf/${calamiteitId}`);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `calamiteit-${calamiteitId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) { setFout(err.message); }
  }

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 320, damping: 35 }}
      className="fixed inset-y-0 right-0 z-50 w-full max-w-md flex flex-col
                 bg-app-elevated border-l border-white/8 shadow-opgeheven overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/6 shrink-0">
        <button
          type="button"
          onClick={bewerkModus ? () => setBewerkModus(false) : onSluit}
          className="w-9 h-9 rounded-full bg-white/6 flex items-center justify-center
                     text-slate-400 active:bg-white/10 transition-colors shrink-0"
          aria-label={bewerkModus ? 'Terug' : 'Sluiten'}
        >
          {bewerkModus ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          ) : '✕'}
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-slate-100 font-bold text-base truncate">
            {bewerkModus ? `Bewerken — #${calamiteitId}` : `Calamiteit #${calamiteitId}`}
          </h2>
          {detail && !bewerkModus && (
            <p className="text-slate-500 text-xs mt-0.5 truncate">
              {detail.rijksweg} — HMP {detail.hmp} — {formaatDatumKort(detail.tijdstip_melding)}
            </p>
          )}
        </div>
        {detail && !bewerkModus && <StatusBadge status={detail.status} />}
      </div>

      {/* Inhoud (scrollbaar) */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* Fout */}
        <AnimatePresence>
          {fout && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex items-start gap-2 p-3 bg-status-gevaar/10 border border-status-gevaar/25 rounded-2xl">
              <span className="text-lg">⚠️</span>
              <p className="text-status-gevaar text-sm flex-1">{fout}</p>
              <button type="button" onClick={() => setFout(null)} className="text-status-gevaar/60 hover:text-status-gevaar">✕</button>
            </motion.div>
          )}
        </AnimatePresence>

        {isLadend ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-8 h-8 rounded-full border-2 border-accent/30 border-t-accent" />
            <p className="text-slate-500 text-sm">Laden…</p>
          </div>

        ) : bewerkModus ? (
          /* ── Bewerkformulier ─────────────────────────────────────────── */
          <AnimatePresence mode="wait">
            <motion.div key="bewerk" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-4">

              {/* Info banner */}
              <div className="flex items-start gap-2 p-3 bg-merk/10 border border-merk/25 rounded-2xl">
                <span className="text-lg shrink-0">ℹ️</span>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Wijzig de gewenste velden. Klik op{' '}
                  <span className="text-slate-300 font-semibold">Opslaan &amp; Herbereken</span>{' '}
                  om de tarieven en PDF opnieuw te berekenen.
                </p>
              </div>

              {/* Tijden */}
              <div className="glas-kaart rounded-2xl p-4 flex flex-col gap-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tijdsregistratie</p>
                {[
                  { naam: 'tijdstip_melding',  label: 'Tijdstip melding' },
                  { naam: 'tijdstip_aanwezig', label: 'Tijdstip aanwezig' },
                  { naam: 'tijdstip_afgerond', label: 'Tijdstip afgerond' },
                ].map(({ naam, label }) => (
                  <div key={naam} className="flex flex-col gap-1.5">
                    <label className="text-slate-400 text-xs font-medium">{label}</label>
                    <input
                      type="datetime-local"
                      value={bewerkData[naam] ?? ''}
                      onChange={(e) => bewerkVeldWijzig(naam, e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5
                                 text-slate-200 text-sm focus:outline-none focus:border-accent/50
                                 focus:bg-white/8 transition-all"
                    />
                  </div>
                ))}
              </div>

              {/* Overige gegevens */}
              <div className="glas-kaart rounded-2xl p-4 flex flex-col gap-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Overige gegevens</p>

                {/* Klant */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-400 text-xs font-medium">Opdrachtgever</label>
                  <select
                    value={bewerkData.klant_id ?? ''}
                    onChange={(e) => bewerkVeldWijzig('klant_id', e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5
                               text-slate-200 text-sm focus:outline-none focus:border-accent/50
                               focus:bg-white/8 transition-all"
                  >
                    <option value="">— Onbekende opdrachtgever —</option>
                    {klanten.map((k) => (
                      <option key={k.id} value={k.id}>{k.naam}</option>
                    ))}
                  </select>
                </div>

                {/* Inspecteur */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-400 text-xs font-medium">Naam inspecteur RWS</label>
                  <input
                    type="text"
                    placeholder="Voor- en achternaam"
                    value={bewerkData.naam_inspecteur_rws ?? ''}
                    onChange={(e) => bewerkVeldWijzig('naam_inspecteur_rws', e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5
                               text-slate-200 text-sm focus:outline-none focus:border-accent/50
                               focus:bg-white/8 transition-all"
                  />
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

        ) : detail ? (
          /* ── Leesmodus ───────────────────────────────────────────────── */
          <>
            {/* Locatiegegevens */}
            <DetailSectie titel="Locatie">
              <DetailRij label="Rijksweg"      waarde={detail.rijksweg} />
              <DetailRij label="HMP"           waarde={detail.hmp} />
              <DetailRij label="Rijrichting"   waarde={detail.rijbaan_richting} />
              <DetailRij label="Aantal stroken" waarde={`${detail.aantal_stroken} strook/stroken`} />
            </DetailSectie>

            {/* Tijdsregistratie */}
            <DetailSectie titel="Tijdsregistratie">
              <DetailRij label="Tijdstip melding"   waarde={formaatDatum(detail.tijdstip_melding)} />
              <DetailRij label="Tijdstip aanwezig"  waarde={formaatDatum(detail.tijdstip_aanwezig)} />
              <DetailRij label="Tijdstip afgerond"  waarde={formaatDatum(detail.tijdstip_afgerond)} />
            </DetailSectie>

            {/* Materieel */}
            {detail.materieel?.length > 0 && (
              <DetailSectie titel="Ingezet materieel">
                {detail.materieel.map((m, i) => (
                  <div key={i} className="flex justify-between items-center py-1.5 border-b border-white/4 last:border-0">
                    <span className="text-slate-300 text-sm">{m.naam ?? `Materieel #${m.materieel_id}`}</span>
                    <div className="text-right">
                      <p className="text-slate-200 text-sm font-medium">× {m.aantal}</p>
                      {m.gefactureerd_uurtarief_snapshot > 0 && (
                        <p className="text-slate-500 text-xs">{formaatGeld(m.gefactureerd_uurtarief_snapshot)}/u</p>
                      )}
                    </div>
                  </div>
                ))}
              </DetailSectie>
            )}

            {/* Toeslagen */}
            {detail.toeslagen?.length > 0 && (
              <DetailSectie titel="Toeslagen">
                {detail.toeslagen.map((t, i) => (
                  <div key={i} className="flex justify-between items-center py-1.5 border-b border-white/4 last:border-0">
                    <span className="text-slate-300 text-sm">{t.naam_toeslag}</span>
                    <div className="text-right">
                      <p className="text-slate-200 text-sm font-medium">{t.aantal_uren} uur</p>
                      <p className="text-slate-500 text-xs">{formaatGeld(t.uurtarief_snapshot)}/u</p>
                    </div>
                  </div>
                ))}
              </DetailSectie>
            )}

            {/* Collega's */}
            {detail.collegas?.length > 0 && (
              <DetailSectie titel="Collega's op locatie">
                <div className="flex flex-wrap gap-2">
                  {detail.collegas.map((c) => (
                    <span key={c.gebruiker_id} className="px-3 py-1 bg-merk/20 border border-merk/30 rounded-full text-sm text-slate-300">
                      {c.naam ?? `Gebruiker #${c.gebruiker_id}`}
                    </span>
                  ))}
                </div>
              </DetailSectie>
            )}

            {/* Veiligheidschecklist */}
            <DetailSectie titel="Veiligheidschecklist">
              <ChecklistRij label="PBM gedragen"     waarde={detail.checklist_pbm} />
              <ChecklistRij label="Werkplek veilig"  waarde={detail.checklist_veilig} />
              <ChecklistRij label="Stortbon"         waarde={detail.checklist_stortbon} />
            </DetailSectie>

            {/* Status wijzigen */}
            <DetailSectie titel="Status beheer">
              {bewerkVeld === 'status' ? (
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    {['Concept', 'Ingezonden'].map((s) => (
                      <button key={s} type="button" onClick={() => setNieuweStatus(s)}
                        className={`flex-1 py-2.5 rounded-2xl text-sm font-semibold border transition-all
                          ${nieuweStatus === s
                            ? 'bg-accent border-accent/50 text-white'
                            : 'bg-white/5 border-white/10 text-slate-400'}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setBewerkVeld(null)}
                      className="flex-1 py-2.5 rounded-2xl text-sm font-medium bg-white/5 border border-white/10 text-slate-400">
                      Annuleren
                    </button>
                    <button type="button" onClick={wijzigStatus} disabled={isBewaren}
                      className="flex-1 py-2.5 rounded-2xl text-sm font-semibold bg-accent text-white disabled:opacity-50">
                      {isBewaren ? 'Opslaan…' : 'Opslaan'}
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setBewerkVeld('status')}
                  className="w-full flex items-center justify-between p-3 bg-white/4 border border-white/8 rounded-2xl hover:bg-white/7 transition-colors">
                  <span className="text-slate-400 text-sm">Huidige status</span>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={detail.status} />
                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                    </svg>
                  </div>
                </button>
              )}
            </DetailSectie>
          </>
        ) : null}
      </div>

      {/* Actie-knoppen onderaan */}
      {detail && (
        <div className="px-5 py-4 border-t border-white/6 flex flex-col gap-2 shrink-0">
          {bewerkModus ? (
            /* Knoppen bewerkformulier */
            <>
              <button
                type="button"
                onClick={opslaanEnHerbereken}
                disabled={isBewaren}
                className="w-full flex items-center justify-center gap-2 min-h-[48px] px-4 py-3
                           text-white font-semibold text-sm rounded-2xl transition-all disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)', boxShadow: '0 4px 16px rgba(249,115,22,0.3)' }}
              >
                {isBewaren ? (
                  <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                    className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
                {isBewaren ? 'Bezig met opslaan…' : 'Opslaan & Herbereken'}
              </button>
              <button
                type="button"
                onClick={() => setBewerkModus(false)}
                className="w-full flex items-center justify-center gap-2 min-h-[48px] px-4 py-3
                           bg-white/5 border border-white/10 text-slate-400 font-medium text-sm
                           rounded-2xl transition-all hover:bg-white/8"
              >
                Annuleren
              </button>
            </>
          ) : (
            /* Knoppen leesmodus */
            <>
              <button
                type="button"
                onClick={openBewerkModus}
                className="w-full flex items-center justify-center gap-2 min-h-[48px] px-4 py-3
                           bg-accent/15 border border-accent/30 text-accent font-semibold text-sm
                           rounded-2xl transition-all hover:bg-accent/20"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                </svg>
                Bewerk formulier
              </button>
              <button
                type="button"
                onClick={herbereken}
                disabled={isHerber}
                className="w-full flex items-center justify-center gap-2 min-h-[48px] px-4 py-3
                           bg-merk/30 border border-merk/40 text-slate-200 font-semibold text-sm
                           rounded-2xl transition-all hover:bg-merk/40 disabled:opacity-40"
              >
                {isHerber ? (
                  <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                    className="w-4 h-4 rounded-full border-2 border-slate-400/30 border-t-slate-300" />
                ) : '🔄'}{' '}
                {isHerber ? 'Herberekening…' : 'Herbereken (zonder wijzigingen)'}
              </button>
              <button
                type="button"
                onClick={downloadPdf}
                className="w-full flex items-center justify-center gap-2 min-h-[48px] px-4 py-3
                           bg-white/5 border border-white/10 text-slate-300 font-medium text-sm
                           rounded-2xl transition-all hover:bg-white/8"
              >
                📄 PDF Downloaden
              </button>
            </>
          )}
        </div>
      )}
    </motion.div>
  );
}

/** Kleine sectie-wrapper in het correctiepaneel. */
function DetailSectie({ titel, children }) {
  return (
    <div className="glas-kaart rounded-2xl p-4">
      {titel && <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{titel}</p>}
      <div className="flex flex-col gap-0">{children}</div>
    </div>
  );
}

/** Eén data-rij in de detail-sectie. */
function DetailRij({ label, waarde }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-white/4 last:border-0">
      <span className="text-slate-500 text-sm">{label}</span>
      <span className="text-slate-200 text-sm font-medium text-right ml-4 truncate max-w-[55%]">{waarde ?? '—'}</span>
    </div>
  );
}

/** Checklist-rij met vinkje of kruisje. */
function ChecklistRij({ label, waarde }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-white/4 last:border-0">
      <span className="text-slate-500 text-sm">{label}</span>
      <span className={`text-sm font-bold ${waarde ? 'text-status-succes' : 'text-status-gevaar'}`}>
        {waarde ? '✓ Ja' : '✗ Nee'}
      </span>
    </div>
  );
}

// ── Hoofd AdminDashboard ──────────────────────────────────────────────────────

// ── Excel Export Modal ────────────────────────────────────────────────────────

/** Berekent het huidige ISO-weeknummer. */
function huidigISOWeek() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

/**
 * Modaal dialoogvenster waarmee de beheerder een jaar en weeknummer kiest
 * vóór het downloaden van het kostenoverzicht als .xlsx.
 */
function ExcelExportModal({ isBezig, fout, onSluit, onDownload }) {
  const huidigJaar = new Date().getFullYear();
  const [jaar, setJaar] = useState(huidigJaar);
  const [week, setWeek] = useState(huidigISOWeek());

  const jaarOpties = [huidigJaar - 1, huidigJaar, huidigJaar + 1];

  return (
    <>
      {/* Backdrop */}
      <motion.div
        key="excel-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onSluit}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
      />

      {/* Dialoogvenster */}
      <motion.div
        key="excel-modal"
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 mx-auto max-w-sm
                   glas-kaart rounded-3xl p-6 flex flex-col gap-5
                   border border-white/12 shadow-opgeheven"
      >
        {/* Koptekst */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-slate-100 font-bold text-lg">Kostenoverzicht exporteren</h3>
            <p className="text-slate-500 text-sm mt-0.5">Kies het jaar en de week</p>
          </div>
          <button type="button" onClick={onSluit}
            className="w-8 h-8 rounded-full bg-white/6 flex items-center justify-center text-slate-400 hover:bg-white/10 transition-colors shrink-0">
            ✕
          </button>
        </div>

        {/* Jaar-kiezer */}
        <div className="flex flex-col gap-2">
          <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Jaar</label>
          <div className="flex gap-2">
            {jaarOpties.map((j) => (
              <button key={j} type="button" onClick={() => setJaar(j)}
                className={`flex-1 py-3 rounded-2xl text-sm font-bold border transition-all
                  ${jaar === j
                    ? 'bg-accent border-accent/50 text-white'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/8'}`}>
                {j}
              </button>
            ))}
          </div>
        </div>

        {/* Week-kiezer */}
        <div className="flex flex-col gap-2">
          <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
            Weeknummer{' '}
            <span className="text-slate-600 normal-case font-normal">(1–53)</span>
          </label>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setWeek((w) => Math.max(1, w - 1))}
              className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center
                         justify-center text-slate-300 text-lg font-bold hover:bg-white/10 transition-colors shrink-0">
              −
            </button>
            <div className="flex-1 text-center">
              <p className="text-slate-100 text-3xl font-bold">{String(week).padStart(2, '0')}</p>
              <p className="text-slate-600 text-xs mt-0.5">week van {jaar}</p>
            </div>
            <button type="button" onClick={() => setWeek((w) => Math.min(53, w + 1))}
              className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center
                         justify-center text-slate-300 text-lg font-bold hover:bg-white/10 transition-colors shrink-0">
              +
            </button>
          </div>
          {/* Directe invoer */}
          <input
            type="number"
            min={1}
            max={53}
            value={week}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v) && v >= 1 && v <= 53) setWeek(v);
            }}
            className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5
                       text-slate-300 text-sm text-center focus:outline-none focus:border-accent/50
                       focus:bg-white/8 transition-all"
            placeholder="Voer weeknummer in"
          />
        </div>

        {/* Foutmelding */}
        <AnimatePresence>
          {fout && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex items-start gap-2 p-3 bg-status-gevaar/10 border border-status-gevaar/25 rounded-2xl">
              <span>⚠️</span>
              <p className="text-status-gevaar text-sm">{fout}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actieknoppen */}
        <div className="flex gap-3">
          <button type="button" onClick={onSluit}
            className="flex-1 py-3 rounded-2xl text-sm font-medium bg-white/5 border border-white/10 text-slate-400 hover:bg-white/8 transition-all">
            Annuleren
          </button>
          <button type="button" onClick={() => onDownload(jaar, week)} disabled={isBezig}
            className="flex-1 py-3 rounded-2xl text-sm font-bold text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #22C55E, #16A34A)', boxShadow: '0 4px 16px rgba(34,197,94,0.3)' }}>
            {isBezig ? (
              <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white" />
            ) : '📊'}
            {isBezig ? 'Genereren…' : 'Download .xlsx'}
          </button>
        </div>
      </motion.div>
    </>
  );
}

// ── Hoofd beheerderspagina ────────────────────────────────────────────────────

export default function AdminDashboard() {
  // ── State ───────────────────────────────────────────────────────────────
  const [calamiteiten,      setCalamiteiten]     = useState([]);
  const [totaalAantal,      setTotaalAantal]     = useState(0);
  const [isLadend,          setIsLadend]         = useState(true);
  const [isExporteren,      setIsExporteren]     = useState(false);
  const [exportFout,        setExportFout]       = useState(null);
  const [toonExcelModal,    setToonExcelModal]   = useState(false);

  // Filters
  const [filterStatus,   setFilterStatus]   = useState('');
  const [filterRijksweg, setFilterRijksweg] = useState('');
  const [filterDatumVan, setFilterDatumVan] = useState('');

  // Correctiepaneel
  const [geselecteerdId,    setGeselecteerdId]   = useState(null);
  const [toonOverlay,       setToonOverlay]      = useState(false);

  // Sorteer
  const [sorteerveld,    setSorteerveld]   = useState('tijdstip_melding');
  const [sorteerRichting, setSorteerRichting] = useState('desc');

  // ── Data ophalen ────────────────────────────────────────────────────────
  const laadCalamiteiten = useCallback(async () => {
    setIsLadend(true);
    try {
      const params = new URLSearchParams({ limit: 100, offset: 0 });
      if (filterStatus)   params.set('status',   filterStatus);
      if (filterRijksweg) params.set('rijksweg',  filterRijksweg.toUpperCase());

      const res = await api.get(`/api/calamiteiten?${params}`);
      const data = res.data ?? [];
      setCalamiteiten(data);
      setTotaalAantal(res.aantal ?? data.length);
    } catch (err) {
      console.error('[AdminDashboard] Laden mislukt:', err.message);
    } finally {
      setIsLadend(false);
    }
  }, [filterStatus, filterRijksweg]);

  useEffect(() => { laadCalamiteiten(); }, [laadCalamiteiten]);

  // ── Excel exporteren (via week-modal) ───────────────────────────────────
  async function exporteerExcel(jaar, week) {
    setIsExporteren(true); setExportFout(null);
    try {
      const blob = await api.getBlob(`/api/export/excel?jaar=${jaar}&week=${week}`);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      const weekPad = String(week).padStart(2, '0');
      a.download = `kostenoverzicht_${jaar}_w${weekPad}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setToonExcelModal(false);
    } catch (err) {
      setExportFout(err.message || 'Exporteren mislukt.');
    } finally {
      setIsExporteren(false);
    }
  }

  // ── Sorteren ────────────────────────────────────────────────────────────
  function wisselSorteer(veld) {
    if (sorteerveld === veld) {
      setSorteerRichting((r) => r === 'asc' ? 'desc' : 'asc');
    } else {
      setSorteerveld(veld);
      setSorteerRichting('desc');
    }
  }

  const gesorteerd = [...calamiteiten].sort((a, b) => {
    const av = a[sorteerveld] ?? '';
    const bv = b[sorteerveld] ?? '';
    const cmp = typeof av === 'string' ? av.localeCompare(bv, 'nl') : (av < bv ? -1 : av > bv ? 1 : 0);
    return sorteerRichting === 'asc' ? cmp : -cmp;
  });

  // Datum-filter client-side (extra)
  const gefilterd = gesorteerd.filter((c) => {
    if (!filterDatumVan) return true;
    return c.tijdstip_melding >= filterDatumVan;
  });

  // ── Statistieken ────────────────────────────────────────────────────────
  const aantalConcept    = calamiteiten.filter((c) => c.status === 'Concept').length;
  const aantalIngezonden = calamiteiten.filter((c) => c.status === 'Ingezonden').length;

  // ── Paneel openen / sluiten ─────────────────────────────────────────────
  function openPanel(id) {
    setGeselecteerdId(id);
    setToonOverlay(true);
  }
  function sluitPanel() {
    setToonOverlay(false);
    setTimeout(() => setGeselecteerdId(null), 300);
  }

  // ── Sorteerpijl ─────────────────────────────────────────────────────────
  function SorteerPijl({ veld }) {
    if (sorteerveld !== veld) return <span className="ml-1 text-slate-700">↕</span>;
    return <span className="ml-1 text-accent">{sorteerRichting === 'asc' ? '↑' : '↓'}</span>;
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      className="flex flex-col gap-5"
    >
      {/* ── Paginakop ────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Admin Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Beheer calamiteiten, stamdata en medewerkers
          </p>
        </div>
        {/* Excel export-knop → opent weekkeuze modal */}
        <motion.button
          type="button"
          onClick={() => setToonExcelModal(true)}
          disabled={isExporteren}
          whileTap={{ scale: 0.96 }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl font-semibold text-sm
                     text-white transition-all disabled:opacity-50 shrink-0"
          style={{
            background: 'linear-gradient(135deg, #22C55E, #16A34A)',
            boxShadow: '0 4px 16px rgba(34,197,94,0.35)',
          }}
        >
          {isExporteren
            ? <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white" />
            : '📊'
          }
          {isExporteren ? 'Exporteren…' : 'Excel Export'}
        </motion.button>
      </div>

      {/* Export fout */}
      <AnimatePresence>
        {exportFout && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 p-3 bg-status-gevaar/10 border border-status-gevaar/25 rounded-2xl text-status-gevaar text-sm">
            ⚠️ {exportFout}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Statistieken-rij ─────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <StatKaart label="Totaal" waarde={totaalAantal} icon="📋" kleur="bg-merk/20"       isLadend={isLadend} />
        <StatKaart label="Concept" waarde={aantalConcept} icon="✏️" kleur="bg-yellow-500/20" isLadend={isLadend} />
        <StatKaart label="Ingezonden" waarde={aantalIngezonden} icon="✅" kleur="bg-status-succes/20" isLadend={isLadend} />
      </div>

      {/* ── Snelkoppelingen beheer ────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { naar: '/admin/stamdata',   emoji: '🗂️', titel: 'Stamdata',   sub: 'Materieel, tarieven, CROW' },
          { naar: '/admin/gebruikers', emoji: '👥', titel: 'Medewerkers', sub: 'Beheer & CSV-import' },
        ].map(({ naar, emoji, titel, sub }) => (
          <Link key={naar} to={naar}>
            <motion.div whileTap={{ scale: 0.97 }}
              className="glas-kaart rounded-2xl p-4 flex items-center gap-3 hover:glas-kaart-hover transition-all">
              <span className="text-2xl">{emoji}</span>
              <div>
                <p className="text-slate-200 text-sm font-semibold">{titel}</p>
                <p className="text-slate-500 text-xs">{sub}</p>
              </div>
            </motion.div>
          </Link>
        ))}
      </div>

      {/* ── Filters ──────────────────────────────────────────────────── */}
      <div className="glas-kaart rounded-2xl p-4 flex flex-wrap gap-3">
        <p className="w-full text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Filters</p>

        {/* Status */}
        <div className="flex gap-1 flex-wrap">
          {['', 'Concept', 'Ingezonden'].map((s) => (
            <button key={s} type="button" onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all
                ${filterStatus === s
                  ? 'bg-accent border-accent/50 text-white'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/8'}`}
            >
              {s || 'Alle statussen'}
            </button>
          ))}
        </div>

        {/* Rijksweg */}
        <input
          type="text"
          placeholder="Filter rijksweg (bijv. A2)"
          value={filterRijksweg}
          onChange={(e) => setFilterRijksweg(e.target.value)}
          className="invoerveld flex-1 min-w-[140px] py-2 text-sm"
          maxLength={10}
        />

        {/* Datum vanaf */}
        <input
          type="date"
          value={filterDatumVan}
          onChange={(e) => setFilterDatumVan(e.target.value)}
          className="invoerveld py-2 text-sm"
        />

        {/* Reset */}
        {(filterStatus || filterRijksweg || filterDatumVan) && (
          <button type="button"
            onClick={() => { setFilterStatus(''); setFilterRijksweg(''); setFilterDatumVan(''); }}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 bg-white/5 border border-white/10 hover:bg-white/8 transition-all">
            ✕ Reset
          </button>
        )}
      </div>

      {/* ── Data-tabel ───────────────────────────────────────────────── */}
      <div className="glas-kaart rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            {/* Tabelkop */}
            <thead>
              <tr className="border-b border-white/8">
                {[
                  { veld: 'id',               label: '#',             breedte: 'w-12' },
                  { veld: 'rijksweg',          label: 'Rijksweg',      breedte: 'w-20' },
                  { veld: 'tijdstip_melding',  label: 'Datum melding', breedte: '' },
                  { veld: 'klant_naam',        label: 'Klant',         breedte: '' },
                  { veld: 'maker_naam',        label: 'Medewerker',    breedte: '' },
                  { veld: 'status',            label: 'Status',        breedte: 'w-32' },
                ].map(({ veld, label, breedte }) => (
                  <th key={veld}
                    onClick={() => wisselSorteer(veld)}
                    className={`${breedte} px-4 py-3 text-left text-xs font-semibold text-slate-500
                                uppercase tracking-wider cursor-pointer hover:text-slate-300 transition-colors select-none`}
                  >
                    {label}<SorteerPijl veld={veld} />
                  </th>
                ))}
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>

            <tbody>
              {isLadend ? (
                Array.from({ length: 5 }).map((_, i) => <SkeletRij key={i} />)
              ) : gefilterd.length === 0 ? (
                <LegeStaat gefilterd={!!(filterStatus || filterRijksweg || filterDatumVan)} />
              ) : (
                gefilterd.map((cal, idx) => (
                  <motion.tr
                    key={cal.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.02 }}
                    onClick={() => openPanel(cal.id)}
                    className="border-b border-white/4 hover:bg-white/3 cursor-pointer
                               transition-colors active:bg-white/5 group"
                  >
                    <td className="px-4 py-3.5 text-slate-500 font-mono text-xs">#{cal.id}</td>
                    <td className="px-4 py-3.5">
                      <span className="font-semibold text-slate-200">{cal.rijksweg}</span>
                      <p className="text-slate-600 text-xs mt-0.5">HMP {cal.hmp}</p>
                    </td>
                    <td className="px-4 py-3.5 text-slate-400 text-xs">
                      {formaatDatumKort(cal.tijdstip_melding)}
                    </td>
                    <td className="px-4 py-3.5 text-slate-300 text-xs">
                      {cal.klant_naam ?? '—'}
                    </td>
                    <td className="px-4 py-3.5 text-slate-400 text-xs">
                      {cal.maker_naam ?? '—'}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={cal.status} />
                    </td>
                    <td className="px-4 py-3.5">
                      <svg className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors"
                        fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Tabelvoet */}
        {!isLadend && gefilterd.length > 0 && (
          <div className="px-4 py-3 border-t border-white/6 flex items-center justify-between">
            <p className="text-slate-600 text-xs">
              {gefilterd.length} van {totaalAantal} calamiteiten
            </p>
            <p className="text-slate-700 text-xs">Klik op een rij voor details</p>
          </div>
        )}
      </div>

      {/* ── Overlay + slide-over paneel ──────────────────────────────── */}
      <AnimatePresence>
        {toonOverlay && (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={sluitPanel}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            />
            <CorrectiePanel
              key="paneel"
              calamiteitId={geselecteerdId}
              onSluit={sluitPanel}
              onBijgewerkt={laadCalamiteiten}
            />
          </>
        )}
      </AnimatePresence>

      {/* ── Excel week-keuze modal ────────────────────────────────────── */}
      <AnimatePresence>
        {toonExcelModal && (
          <ExcelExportModal
            isBezig={isExporteren}
            fout={exportFout}
            onSluit={() => { setToonExcelModal(false); setExportFout(null); }}
            onDownload={exporteerExcel}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
