/**
 * Stap3Registratie.jsx — Wizard stap 3: Registratie
 * ---------------------------------------------------
 * Secties:
 *   1. Klant-selectie
 *   2. Tijdsregistratie (melding / aanwezig / afgerond)
 *   3. Collega's (multi-select van actieve gebruikers)
 *   4. Materieel (dynamische lijst met aantallen)
 *   5. Inspecteur RWS + Restschade
 *   6. Veiligheidschecklist (verplicht Ja/Nee)
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../utils/apiClient.js';
import {
  ToggleSchakelaar,
  JaNeeToggle,
  VeldGroep,
  WizardSectie,
  FoutTekst,
} from './wizardUi.jsx';

// ── Hulpfunctie: formatteert een naam met hoofdletters maar tussenvoegsels klein ─
// Voorbeeld: 'jan van der berg' → 'Jan van der Berg'
const TUSSENVOEGSELS = new Set([
  'van', 'de', 'der', 'den', 'het', 'ter', 'te', 'ten', 'in', 'op', 'aan', 'bij', 'voor', 'tot',
]);

function formaatNaamInspecteur(waarde) {
  const woorden = waarde.trim().split(/\s+/);
  if (woorden.length === 0) return waarde;
  return woorden.map((woord, index) => {
    const lager = woord.toLowerCase();
    // Tussenvoegsels midden in de naam (niet het eerste én niet het laatste woord) → kleine letter
    if (index > 0 && index < woorden.length - 1 && TUSSENVOEGSELS.has(lager)) {
      return lager;
    }
    return lager.charAt(0).toUpperCase() + lager.slice(1);
  }).join(' ');
}

// ── Hulpfunctie: geeft huidige tijd in datetime-local formaat ─────────────────
function nuAlsDatumTijd() {
  const nu = new Date();
  nu.setSeconds(0, 0);
  return nu.toISOString().slice(0, 16);
}

// ── Materieel rij ─────────────────────────────────────────────────────────────
function MaterieelRij({ item, beschikbaar, onWijzig, onVerwijder }) {
  const gevondenItem = beschikbaar.find((m) => String(m.id) === String(item.materieelId));

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex items-center gap-2 p-3 bg-white/3 border border-white/6 rounded-2xl"
    >
      {/* Naam / dropdown */}
      <select
        value={item.materieelId}
        onChange={(e) => onWijzig({ ...item, materieelId: e.target.value })}
        className="invoerveld flex-1 py-2 min-h-[44px] text-sm"
        aria-label="Materieel selecteren"
      >
        <option value="">— Kies materieel —</option>
        {beschikbaar.map((m) => (
          <option key={m.id} value={m.id}>
            {m.naam} ({m.eenheid})
          </option>
        ))}
      </select>

      {/* Aantal − + */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => onWijzig({ ...item, aantal: Math.max(1, item.aantal - 1) })}
          className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-300 active:bg-white/10 font-bold"
          aria-label="Minder"
        >
          −
        </button>
        <span className="w-8 text-center text-slate-100 font-semibold text-sm">
          {item.aantal}
        </span>
        <button
          type="button"
          onClick={() => onWijzig({ ...item, aantal: item.aantal + 1 })}
          className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-300 active:bg-white/10 font-bold"
          aria-label="Meer"
        >
          +
        </button>
      </div>

      {/* Verwijder */}
      <button
        type="button"
        onClick={onVerwijder}
        className="w-9 h-9 rounded-xl bg-status-gevaar/10 border border-status-gevaar/20 flex items-center justify-center text-status-gevaar active:bg-status-gevaar/20 shrink-0"
        aria-label="Verwijder materieel"
      >
        ×
      </button>
    </motion.div>
  );
}

// ── Collega toggle rij ────────────────────────────────────────────────────────
function CollegaRij({ gebruiker, geselecteerd, onToggle }) {
  return (
    <motion.button
      type="button"
      onClick={() => onToggle(gebruiker.id)}
      whileTap={{ scale: 0.98 }}
      animate={{
        backgroundColor: geselecteerd
          ? 'rgba(249,115,22,0.08)'
          : 'rgba(255,255,255,0.03)',
        borderColor: geselecteerd
          ? 'rgba(249,115,22,0.4)'
          : 'rgba(255,255,255,0.08)',
      }}
      className="flex items-center gap-3 p-3 rounded-2xl border w-full text-left"
    >
      {/* Avatar */}
      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0
                        ${geselecteerd ? 'bg-accent/20 text-accent' : 'bg-white/8 text-slate-400'}`}>
        {gebruiker.naam.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-slate-200 text-sm font-medium truncate">{gebruiker.naam}</p>
        <p className="text-slate-500 text-xs">{gebruiker.rol}</p>
      </div>
      {/* Vinkje */}
      <AnimatePresence>
        {geselecteerd && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="w-6 h-6 rounded-full bg-accent flex items-center justify-center shrink-0"
          >
            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

// ── Stap 3 hoofdcomponent ─────────────────────────────────────────────────────

export default function Stap3Registratie({ formData, bijwerken, fouten, huidigeGebruikerId }) {
  const [klanten,    setKlanten]   = useState([]);
  const [gebruikers, setGebruikers] = useState([]);
  const [materieel,  setMaterieel] = useState([]);
  const [isLadend,   setIsLadend]  = useState(true);
  const [laadFout,   setLaadFout]  = useState(null);

  // ── Data ophalen bij mounten ──────────────────────────────────────────────
  // Promise.allSettled zodat één mislukte aanvraag de rest niet blokkeert.
  // Elke response volgt het formaat { succes: true, data: [...] }.
  const laadData = useCallback(async () => {
    setIsLadend(true);
    setLaadFout(null);

    const [klantenRes, gebruikersRes, materieelRes] = await Promise.allSettled([
      api.get('/api/klanten'),
      api.get('/api/gebruikers'),
      api.get('/api/materieel'),
    ]);

    // Klanten
    if (klantenRes.status === 'fulfilled') {
      setKlanten(klantenRes.value?.data ?? []);
    } else {
      console.error('[Stap3] Klanten laden mislukt:', klantenRes.reason?.message);
    }

    // Collega's — huidige gebruiker uitsluiten, alleen actieve medewerkers
    if (gebruikersRes.status === 'fulfilled') {
      const lijst = gebruikersRes.value?.data ?? [];
      setGebruikers(
        lijst.filter((g) => Number(g.id) !== Number(huidigeGebruikerId) && g.actief)
      );
    } else {
      console.error('[Stap3] Gebruikers laden mislukt:', gebruikersRes.reason?.message);
    }

    // Materieel — backend stuurt al alleen actief materieel, maar we filteren dubbel-zekerheidshalve
    if (materieelRes.status === 'fulfilled') {
      setMaterieel((materieelRes.value?.data ?? []).filter((m) => m.actief));
    } else {
      console.error('[Stap3] Materieel laden mislukt:', materieelRes.reason?.message);
    }

    // Toon een foutbanner als minstens één aanvraag mislukte
    const mislukt = [klantenRes, gebruikersRes, materieelRes].filter(
      (r) => r.status === 'rejected'
    );
    if (mislukt.length > 0) {
      setLaadFout('Niet alle gegevens konden worden geladen. Controleer uw verbinding.');
    }

    setIsLadend(false);
  }, [huidigeGebruikerId]);

  useEffect(() => { laadData(); }, [laadData]);

  // ── Tijdstip-initialisatie (zet melding op 'nu' als leeg) ─────────────────
  useEffect(() => {
    if (!formData.tijdstipMelding) {
      bijwerken('tijdstipMelding', nuAlsDatumTijd());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Materieel helpers ─────────────────────────────────────────────────────
  function voegMaterieelToe() {
    bijwerken('materieel', [
      ...formData.materieel,
      { _id: Date.now(), materieelId: '', aantal: 1 },
    ]);
  }

  function wijzigMaterieelRij(index, nieuweRij) {
    const kopie = [...formData.materieel];
    kopie[index] = nieuweRij;
    bijwerken('materieel', kopie);
  }

  function verwijderMaterieelRij(index) {
    bijwerken('materieel', formData.materieel.filter((_, i) => i !== index));
  }

  // ── Collega helpers ───────────────────────────────────────────────────────
  function toggleCollega(id) {
    const geselecteerd = formData.collegas.includes(id);
    bijwerken(
      'collegas',
      geselecteerd
        ? formData.collegas.filter((c) => c !== id)
        : [...formData.collegas, id]
    );
  }

  // ── Laadscherm ────────────────────────────────────────────────────────────
  if (isLadend) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-10 h-10 rounded-full border-2 border-accent/30 border-t-accent"
        />
        <p className="text-slate-500 text-sm">Gegevens laden…</p>
      </div>
    );
  }

  // ── Foutbanner (partieel) ─────────────────────────────────────────────────
  const foutBanner = laadFout ? (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-2 p-3 mb-2 bg-yellow-500/10 border border-yellow-500/25 rounded-2xl"
    >
      <span className="text-lg shrink-0">⚠️</span>
      <div className="flex-1 min-w-0">
        <p className="text-yellow-400 text-sm">{laadFout}</p>
        <button
          type="button"
          onClick={laadData}
          className="text-yellow-400 text-xs underline mt-0.5"
        >
          Opnieuw proberen
        </button>
      </div>
    </motion.div>
  ) : null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      {foutBanner}

      {/* Koptekst */}
      <div className="mb-1">
        <h2 className="text-xl font-bold text-slate-100">Registratie</h2>
        <p className="text-slate-500 text-sm mt-0.5">
          Vul de calamiteitsgegevens in
        </p>
      </div>

      {/* ── Sectie 0: Omschrijving calamiteit ────────────────────────── */}
      <WizardSectie titel="Omschrijving">
        <VeldGroep label="Omschrijving van de calamiteit">
          <textarea
            rows={4}
            placeholder="Beschrijf hier wat er is gebeurd: situatie op de weg, aard van de calamiteit, weersomstandigheden, bijzonderheden…"
            value={formData.omschrijving}
            onChange={(e) => bijwerken('omschrijving', e.target.value)}
            className="invoerveld resize-none leading-relaxed"
          />
        </VeldGroep>
      </WizardSectie>

      {/* ── Sectie 1: Klant ────────────────────────────────────────────── */}
      <WizardSectie titel="Klant">
        <VeldGroep label="Opdrachtgever" fout={fouten.klantId}>
          <select
            value={formData.klantId}
            onChange={(e) => bijwerken('klantId', e.target.value)}
            className="invoerveld"
          >
            <option value="">— Onbekende opdrachtgever —</option>
            {klanten.map((k) => (
              <option key={k.id} value={k.id}>{k.naam}</option>
            ))}
          </select>
        </VeldGroep>
      </WizardSectie>

      {/* ── Sectie 2: Tijdsregistratie ───────────────────────────────── */}
      <WizardSectie titel="Tijdsregistratie">
        <VeldGroep label="Tijdstip melding" fout={fouten.tijdstipMelding} verplicht>
          <input
            type="datetime-local"
            value={formData.tijdstipMelding}
            onChange={(e) => bijwerken('tijdstipMelding', e.target.value)}
            className="invoerveld"
          />
        </VeldGroep>

        <VeldGroep label="Tijdstip aanwezig op locatie" fout={fouten.tijdstipAanwezig} verplicht>
          <input
            type="datetime-local"
            value={formData.tijdstipAanwezig}
            min={formData.tijdstipMelding}
            onChange={(e) => bijwerken('tijdstipAanwezig', e.target.value)}
            className="invoerveld"
          />
        </VeldGroep>

        <VeldGroep label="Tijdstip afgerond" fout={fouten.tijdstipAfgerond} verplicht>
          <input
            type="datetime-local"
            value={formData.tijdstipAfgerond}
            min={formData.tijdstipAanwezig || formData.tijdstipMelding}
            onChange={(e) => bijwerken('tijdstipAfgerond', e.target.value)}
            className="invoerveld"
          />
        </VeldGroep>

        {/* Toon berekende duur als beide tijden zijn ingevuld */}
        <AnimatePresence>
          {formData.tijdstipAanwezig && formData.tijdstipAfgerond && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 px-4 py-3 bg-merk/10 border border-merk/20 rounded-2xl"
            >
              <span>⏱️</span>
              <div>
                <p className="text-slate-300 text-sm font-medium">
                  Duur:{' '}
                  {berekenDuur(formData.tijdstipAanwezig, formData.tijdstipAfgerond)}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </WizardSectie>

      {/* ── Sectie 3: Collega's ──────────────────────────────────────── */}
      <WizardSectie titel="Collega's op locatie">
        {gebruikers.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-3">
            Geen andere medewerkers gevonden
          </p>
        ) : (
          <div className="flex flex-col gap-2 max-h-52 overflow-y-auto">
            {gebruikers.map((g) => (
              <CollegaRij
                key={g.id}
                gebruiker={g}
                geselecteerd={formData.collegas.includes(g.id)}
                onToggle={toggleCollega}
              />
            ))}
          </div>
        )}
        {formData.collegas.length > 0 && (
          <p className="text-accent text-xs text-center">
            {formData.collegas.length} collega(s) geselecteerd
          </p>
        )}
      </WizardSectie>

      {/* ── Sectie 4: Materieel ──────────────────────────────────────── */}
      <WizardSectie titel="Ingezet materieel">
        <AnimatePresence>
          {formData.materieel.map((item, idx) => (
            <MaterieelRij
              key={item._id ?? idx}
              item={item}
              beschikbaar={materieel}
              onWijzig={(nieuw) => wijzigMaterieelRij(idx, nieuw)}
              onVerwijder={() => verwijderMaterieelRij(idx)}
            />
          ))}
        </AnimatePresence>

        <motion.button
          type="button"
          onClick={voegMaterieelToe}
          whileTap={{ scale: 0.97 }}
          className="w-full flex items-center justify-center gap-2 min-h-[48px]
                     border border-dashed border-white/15 rounded-2xl
                     text-slate-400 text-sm hover:border-white/25 hover:text-slate-300
                     transition-all"
        >
          <span className="text-lg">+</span>
          Voeg materieel toe
        </motion.button>
        <FoutTekst bericht={fouten.materieel} />
      </WizardSectie>

      {/* ── Sectie 5: Inspecteur + Restschade + Vervolgactie ─────────── */}
      <WizardSectie titel="Overige gegevens">
        <VeldGroep label="Naam inspecteur RWS" fout={fouten.naamInspecteurRws} verplicht>
          <input
            type="text"
            placeholder="Voor- en achternaam"
            value={formData.naamInspecteurRws}
            onChange={(e) => bijwerken('naamInspecteurRws', e.target.value)}
            onBlur={(e) => {
              const opgemaakt = formaatNaamInspecteur(e.target.value);
              if (opgemaakt !== e.target.value) bijwerken('naamInspecteurRws', opgemaakt);
            }}
            className="invoerveld"
          />
        </VeldGroep>

        {/* Restschade toggle — flex-wrap voor mobiel zodat toggle niet buiten beeld valt */}
        <div className="flex items-start justify-between gap-3 py-1">
          <div className="flex-1 min-w-0">
            <p className="text-slate-200 text-sm font-medium">Restschade aanwezig</p>
            <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">Schade die achterblijft na de calamiteit</p>
          </div>
          <div className="shrink-0 pt-0.5">
            <ToggleSchakelaar
              waarde={formData.restschade}
              onChange={(v) => bijwerken('restschade', v)}
            />
          </div>
        </div>

        {/* Omschrijving restschade (alleen als actief) */}
        <AnimatePresence>
          {formData.restschade && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <VeldGroep label="Omschrijving restschade: (tijdspad + inzet)" fout={fouten.restschadeOmschrijving} verplicht>
                <textarea
                  rows={3}
                  placeholder="Omschrijf het tijdspad en de inzet: wanneer ontdekt, welke maatregelen genomen, welk materieel ingezet…"
                  value={formData.restschadeOmschrijving}
                  onChange={(e) => bijwerken('restschadeOmschrijving', e.target.value)}
                  className="invoerveld resize-none"
                />
              </VeldGroep>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Vervolgactie toggle */}
        <div className="flex items-start justify-between gap-3 py-1 mt-1">
          <div className="flex-1 min-w-0">
            <p className="text-slate-200 text-sm font-medium">Vervolgactie vereist</p>
            <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">Er is een vervolgactie nodig na deze calamiteit</p>
          </div>
          <div className="shrink-0 pt-0.5">
            <ToggleSchakelaar
              waarde={formData.vervolgactie}
              onChange={(v) => bijwerken('vervolgactie', v)}
            />
          </div>
        </div>

        {/* Omschrijving vervolgactie (alleen als actief) */}
        <AnimatePresence>
          {formData.vervolgactie && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <VeldGroep label="Omschrijving vervolgactie" fout={fouten.vervolgactieOmschrijving} verplicht>
                <textarea
                  rows={3}
                  placeholder="Beschrijf welke actie(s) nog nodig zijn en door wie…"
                  value={formData.vervolgactieOmschrijving}
                  onChange={(e) => bijwerken('vervolgactieOmschrijving', e.target.value)}
                  className="invoerveld resize-none"
                />
              </VeldGroep>
            </motion.div>
          )}
        </AnimatePresence>
      </WizardSectie>

      {/* ── Sectie 6: Veiligheidschecklist ──────────────────────────── */}
      <WizardSectie titel="⚠️ Veiligheidschecklist (verplicht)">
        <div className="p-3 bg-yellow-500/8 border border-yellow-500/20 rounded-2xl">
          <p className="text-yellow-400 text-xs leading-relaxed">
            Alle 5 de stellingen moeten worden bevestigd vóór indiening.
          </p>
        </div>

        {[
          {
            sleutel: 'checklistPbm',
            label: "Gebruik van PBM\u2019s (oranje hesjes, veiligheidsschoenen, gehoorbescherming, helm, e.d.).",
            emoji: '🦺',
            fout: fouten.checklistPbm,
          },
          {
            sleutel: 'checklistFotosCalamiteit',
            label: 'Er zijn foto\u2019s gemaakt waaruit blijkt dat de omschreven calamiteit heeft plaatsgevonden.',
            emoji: '📷',
            fout: fouten.checklistFotosCalamiteit,
          },
          {
            sleutel: 'checklistFotosAanpak',
            label: 'Er zijn foto\u2019s gemaakt waaruit blijkt dat de gevolgde aanpak heeft plaatsgevonden.',
            emoji: '📸',
            fout: fouten.checklistFotosAanpak,
          },
          {
            sleutel: 'checklistVeilig',
            label: 'De weg is weer veilig, (hulp)materialen en afvalstoffen zijn van de weg af.',
            emoji: '✅',
            fout: fouten.checklistVeilig,
          },
          {
            sleutel: 'checklistStortbon',
            label: 'Indien van toepassing is er een stortbon ontvangen van afgevoerde materialen.',
            emoji: '🧾',
            fout: fouten.checklistStortbon,
          },
        ].map(({ sleutel, label, emoji, fout }) => (
          <div key={sleutel} className="flex flex-col gap-2">
            <div className="flex items-start gap-2.5">
              <span className="text-xl mt-0.5">{emoji}</span>
              <p className="text-slate-200 text-sm leading-relaxed flex-1">{label}</p>
            </div>
            <JaNeeToggle
              waarde={formData[sleutel]}
              onChange={(v) => bijwerken(sleutel, v)}
              fout={fout}
            />
            <FoutTekst bericht={fout} />
          </div>
        ))}
      </WizardSectie>
    </div>
  );
}

// ── Hulpfunctie: berekent leesbare duur ──────────────────────────────────────

function berekenDuur(van, tot) {
  try {
    const msVerschil = new Date(tot) - new Date(van);
    if (msVerschil <= 0) return '—';
    const uren    = Math.floor(msVerschil / 3_600_000);
    const minuten = Math.floor((msVerschil % 3_600_000) / 60_000);
    return `${uren}u ${String(minuten).padStart(2, '0')}min`;
  } catch {
    return '—';
  }
}
