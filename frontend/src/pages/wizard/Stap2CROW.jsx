/**
 * Stap2CROW.jsx — Wizard stap 2: CROW Berekening
 * ------------------------------------------------
 * Haalt de berekende bordinstellingen op via de backend API.
 * Toont per bordobject: naam + berekende HMP-positie.
 * Ondersteunt handmatige overschrijving van elke positie.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../utils/apiClient.js';
import { WizardSectie, FoutTekst } from './wizardUi.jsx';

// ── Iconen ────────────────────────────────────────────────────────────────────

function IcoonPotlood() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round"
            d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
    </svg>
  );
}

function IcoonHerladen() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round"
            d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  );
}

// ── Hulpfuncties ──────────────────────────────────────────────────────────────

/**
 * Formatteert een HMP-getal naar 3 decimalen (bijv. 255.1 → "255.100").
 * @param {string|number} waarde
 * @returns {string}
 */
function formateerHMP(waarde) {
  const getal = parseFloat(waarde);
  return isNaN(getal) ? String(waarde) : getal.toFixed(3);
}

// ── Stap 2 Component ──────────────────────────────────────────────────────────

/**
 * @param {{
 *   formData: object,
 *   bijwerken: Function,
 *   fouten: object
 * }} props
 */
export default function Stap2CROW({ formData, bijwerken, fouten }) {
  const [isLadend,       setIsLadend]       = useState(false);
  const [apiFout,        setApiFout]        = useState(null);
  const [overschrijving, setOverschrijving] = useState(false);
  const [ladenPDOK,      setLadenPDOK]      = useState(false);

  // Lokale kopie van overrides voor direct bewerken
  const [lokaleOverrides, setLokaleOverrides] = useState(
    formData.crowOverrides || {}
  );

  // ── CROW API aanroepen ────────────────────────────────────────────────────
  const bereken = useCallback(async () => {
    setIsLadend(true);
    setApiFout(null);

    try {
      // Parseer HMP: vervang komma door punt en zet om naar getal
      const hmpGetal = parseFloat(String(formData.hmp).replace(',', '.'));

      const params = new URLSearchParams({
        hmp:     hmpGetal,
        richting: formData.rijrichting,         // exact 'Oplopend' of 'Aflopend'
        stroken:  Number(formData.aantalStroken), // Number 1 of 2 — backend valideert 'stroken'
      });

      const data = await api.get(`/api/calamiteiten/crow-berekening?${params}`);

      // Backend retourneert { succes: true, plaatsingen: [...] }
      bijwerken('crowResultaten', data.plaatsingen ?? data.resultaten ?? []);
      // Overrides resetten bij nieuwe berekening
      setLokaleOverrides({});
      bijwerken('crowOverrides', {});
    } catch (err) {
      setApiFout(err.message || 'CROW-berekening kon niet worden uitgevoerd.');
    } finally {
      setIsLadend(false);
    }
  }, [formData.rijksweg, formData.hmp, formData.rijrichting, formData.aantalStroken, bijwerken]);

  // Automatisch berekenen bij het laden van deze stap (als nog niet gedaan)
  useEffect(() => {
    if (!formData.crowResultaten || formData.crowResultaten.length === 0) {
      bereken();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Override bijwerken ────────────────────────────────────────────────────
  function wijzigOverride(objectNaam, nieuweWaarde) {
    const bijgewerkt = { ...lokaleOverrides, [objectNaam]: nieuweWaarde };
    setLokaleOverrides(bijgewerkt);
    bijwerken('crowOverrides', bijgewerkt);
  }

  // ── Overschrijvingen opslaan en vergrendelen ──────────────────────────────
  function bevestigOverrides() {
    setOverschrijving(false);
  }

  // ── PDOK GPS-navigatie: drop een exacte pin voor een gegeven HMP ─────────
  // Probeert het paaltje in 3 pogingen te vinden in de RWS-database.
  const openGoogleMaps = useCallback(async (hmpDoel) => {
    setLadenPDOK(true);
    try {
      const weg      = String(formData.rijksweg).replace(/\s+/g, '').toUpperCase();
      // Nederlandse PDOK-notatie: 199.0 → 199,0
      const pdokHmp  = parseFloat(hmpDoel).toFixed(1).replace('.', ',');
      const zijde    = formData.rijrichting === 'Oplopend' ? 'Re' : 'Li';
      const basisUrl = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?fq=type:hectometerpaal&rows=1';

      // Hulpfunctie: haal centroide_ll op voor een zoekopdracht
      const fetchPunt = async (zoekopdracht) => {
        const res  = await fetch(`${basisUrl}&q=${encodeURIComponent(zoekopdracht)}`);
        const json = await res.json();
        return json?.response?.docs?.[0]?.centroide_ll ?? null;
      };

      // Poging 1: exacte zijde (Re of Li)
      let punt = await fetchPunt(`${weg} ${pdokHmp} ${zijde}`);

      // Poging 2: andere zijde — paal staat soms net aan de overkant
      if (!punt) {
        const andereZijde = zijde === 'Re' ? 'Li' : 'Re';
        punt = await fetchPunt(`${weg} ${pdokHmp} ${andereZijde}`);
      }

      // Poging 3: zonder zijde
      if (!punt) {
        punt = await fetchPunt(`${weg} ${pdokHmp}`);
      }

      if (punt) {
        // "POINT(lng lat)" → exacte rode pin op Google Maps
        const match = punt.match(/POINT\(([\d.]+)\s([\d.]+)\)/);
        if (match) {
          const lng = match[1];
          const lat = match[2];
          window.open(`https://www.google.com/maps/place/${lat},${lng}`, '_blank');
          return;
        }
      }

      // Geen paal gevonden → duidelijke melding
      alert(
        `Hectometerpaal ${weg} ${pdokHmp} kon niet worden gevonden ` +
        `in de Rijkswaterstaat-database.\n` +
        `Controleer het wegnummer en probeer opnieuw.`
      );
    } catch (err) {
      console.error('PDOK navigatie fout:', err);
      alert('Er kon geen verbinding worden gemaakt met de server van Rijkswaterstaat.');
    } finally {
      setLadenPDOK(false);
    }
  }, [formData.rijksweg, formData.rijrichting]);

  // ── Render ────────────────────────────────────────────────────────────────

  const resultaten      = formData.crowResultaten || [];
  const heeftResultaten = resultaten.length > 0;

  // HMP van het incident zelf (ingevoerd in Stap 1)
  const hmpIncident = parseFloat(String(formData.hmp ?? '0').replace(',', '.'));

  // HMP van het vroegste waarschuwingsbord (met eventuele handmatige overrides)
  const hmpWaarschuwing = (() => {
    if (!heeftResultaten) return null;
    const posities = resultaten
      .map((r) => parseFloat(lokaleOverrides[r.object_naam] ?? r.hmp_positie))
      .filter((p) => !isNaN(p));
    if (!posities.length) return null;
    // Oplopend: laagste positie is het verste bord vóór het incident
    // Aflopend: hoogste positie is het verste bord vóór het incident
    return formData.rijrichting === 'Oplopend' ? Math.min(...posities) : Math.max(...posities);
  })();

  return (
    <div className="flex flex-col gap-4">
      {/* Koptekst */}
      <div className="mb-1">
        <h2 className="text-xl font-bold text-slate-100">CROW Berekening</h2>
        <p className="text-slate-500 text-sm mt-0.5">
          Bordinstellingen op basis van HMP {formData.hmp} — {formData.rijksweg}
        </p>
      </div>

      {/* ── Laadstatus ─────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {isLadend && (
          <motion.div
            key="laden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="glas-kaart rounded-3xl p-8 flex flex-col items-center gap-4"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-10 h-10 rounded-full border-2 border-accent/30 border-t-accent"
            />
            <p className="text-slate-400 text-sm">CROW-posities berekenen…</p>
          </motion.div>
        )}

        {/* ── API-fout ──────────────────────────────────────────────────── */}
        {!isLadend && apiFout && (
          <motion.div
            key="fout"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-status-gevaar/10 border border-status-gevaar/25 rounded-3xl flex flex-col gap-3"
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="text-status-gevaar font-semibold text-sm">Berekening mislukt</p>
                <p className="text-slate-400 text-xs mt-0.5">{apiFout}</p>
              </div>
            </div>
            <button type="button" onClick={bereken} className="knop-secondair">
              <IcoonHerladen /> Opnieuw proberen
            </button>
          </motion.div>
        )}

        {/* ── Resultaten ───────────────────────────────────────────────── */}
        {!isLadend && heeftResultaten && (
          <motion.div
            key="resultaten"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-3"
          >
            {/* Succesheader */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-status-succes animate-pulse" />
                <span className="text-status-succes text-sm font-medium">
                  {resultaten.length} borden berekend
                </span>
              </div>
              {/* Herbereken-knop */}
              <button
                type="button"
                onClick={bereken}
                className="flex items-center gap-1.5 text-slate-500 text-xs hover:text-slate-300 transition-colors p-2"
              >
                <IcoonHerladen />
                Herbereken
              </button>
            </div>

            {/* Bordingenlijst */}
            <WizardSectie titel="Bordinstellingen">
              <div className="flex flex-col gap-2">
                {resultaten.map((item, idx) => {
                  const heeftOverride = lokaleOverrides[item.object_naam] !== undefined;
                  const toonWaarde   = heeftOverride
                    ? lokaleOverrides[item.object_naam]
                    : formateerHMP(item.hmp_positie);

                  return (
                    <motion.div
                      key={item.object_naam}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      className={`flex items-center justify-between p-3 rounded-2xl border
                                  ${heeftOverride
                                    ? 'bg-yellow-500/8 border-yellow-500/25'
                                    : 'bg-white/3 border-white/6'}`}
                    >
                      {/* Bordobject-naam */}
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0
                                         ${heeftOverride ? 'bg-yellow-500/20 text-yellow-400' : 'bg-accent/15 text-accent'}`}>
                          {idx + 1}
                        </div>
                        <span className="text-slate-200 text-sm font-medium truncate">
                          {item.object_naam}
                        </span>
                      </div>

                      {/* HMP-waarde (bewerkbaar in overschrijvings-modus) */}
                      <div className="flex items-center gap-2 shrink-0">
                        {overschrijving ? (
                          <input
                            type="text"
                            inputMode="decimal"
                            value={lokaleOverrides[item.object_naam] ?? formateerHMP(item.hmp_positie)}
                            onChange={(e) => wijzigOverride(item.object_naam, e.target.value)}
                            className="w-24 px-2 py-1.5 rounded-xl text-sm text-right font-mono
                                       bg-slate-800 border border-accent/60 text-white
                                       focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
                            aria-label={`HMP-positie voor ${item.object_naam}`}
                          />
                        ) : (
                          <span className={`font-mono text-sm font-semibold
                                           ${heeftOverride ? 'text-yellow-400' : 'text-slate-200'}`}>
                            {toonWaarde}
                            {heeftOverride && (
                              <span className="ml-1 text-yellow-600 text-[10px]">✎</span>
                            )}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </WizardSectie>

            {/* ── Handmatige overschrijving ────────────────────────────── */}
            <WizardSectie>
              <div className="flex items-start gap-3">
                <span className="text-2xl mt-0.5">🗺️</span>
                <div className="flex-1">
                  <p className="text-slate-200 text-sm font-semibold">Handmatige overschrijving</p>
                  <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">
                    In het veld kan de werkelijke weg afwijken van de berekening door HMP-sprongen.
                    Activeer overschrijving om posities aan te passen.
                  </p>
                </div>
              </div>

              {overschrijving ? (
                <button
                  type="button"
                  onClick={bevestigOverrides}
                  className="knop-primair"
                >
                  ✓ Posities bevestigen
                </button>
              ) : (
                <motion.button
                  type="button"
                  onClick={() => setOverschrijving(true)}
                  whileTap={{ scale: 0.97 }}
                  className="w-full flex items-center justify-center gap-2 min-h-[48px] px-5 py-3
                             bg-yellow-500/10 border border-yellow-500/25 text-yellow-400
                             font-semibold text-sm rounded-2xl transition-all
                             active:bg-yellow-500/20"
                >
                  <IcoonPotlood /> Posities handmatig aanpassen
                </motion.button>
              )}

              {/* Toon samenvatting van actieve overrides */}
              <AnimatePresence>
                {Object.keys(lokaleOverrides).length > 0 && !overschrijving && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2 px-3 py-2 bg-yellow-500/8 rounded-xl"
                  >
                    <span className="text-yellow-400 text-xs">
                      ✎ {Object.keys(lokaleOverrides).length} positie(s) handmatig aangepast
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </WizardSectie>
          </motion.div>
        )}

        {/* ── GPS-navigatieknoppen ─────────────────────────────────── */}
        {!isLadend && heeftResultaten && !isNaN(hmpIncident) && hmpWaarschuwing !== null && (
          <motion.div
            key="navigatie"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-3"
          >
            {/* Spinner terwijl PDOK bezig is */}
            {ladenPDOK && (
              <div className="flex items-center justify-center gap-2 py-1">
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                  className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                />
                <span className="text-slate-400 text-xs">Coördinaten ophalen via PDOK…</span>
              </div>
            )}

            {/* Knop 1 — Locatie calamiteit (rood/oranje) */}
            <motion.button
              type="button"
              onClick={() => openGoogleMaps(hmpIncident)}
              disabled={ladenPDOK}
              whileTap={{ scale: 0.97 }}
              className="w-full flex items-center justify-center gap-3 min-h-[54px] px-5 py-3
                         rounded-2xl font-bold text-white text-sm disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, #C2410C, #EA580C)',
                boxShadow:  '0 4px 16px rgba(234,88,12,0.4)',
              }}
            >
              <span className="text-lg">📍</span>
              Locatie Calamiteit (HMP {hmpIncident.toFixed(1)})
            </motion.button>

            {/* Knop 2 — Locatie eerste waarschuwing (groen) */}
            <motion.button
              type="button"
              onClick={() => openGoogleMaps(hmpWaarschuwing)}
              disabled={ladenPDOK}
              whileTap={{ scale: 0.97 }}
              className="w-full flex items-center justify-center gap-3 min-h-[54px] px-5 py-3
                         rounded-2xl font-bold text-white text-sm disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, #15803D, #16A34A)',
                boxShadow:  '0 4px 16px rgba(22,163,74,0.4)',
              }}
            >
              <span className="text-lg">⚠️</span>
              Locatie Eerste Waarschuwing (HMP {hmpWaarschuwing.toFixed(1)})
            </motion.button>

            <p className="text-slate-500 text-xs text-center leading-relaxed px-2">
              GPS via RWS hectometerpaal-database (PDOK) · plaatst een exacte pin op Google Maps
            </p>
          </motion.div>
        )}

        {/* Validatiefout */}
        {fouten.crowResultaten && (
          <FoutTekst bericht={fouten.crowResultaten} />
        )}
      </AnimatePresence>
    </div>
  );
}
