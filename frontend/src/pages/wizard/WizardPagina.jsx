/**
 * WizardPagina.jsx — Calamiteiten Registratie Wizard
 * ===================================================
 * Orchestrator voor het meervoudig stappenformulier.
 *
 * Verantwoordelijkheden:
 *   - Beheert de gecombineerde formData-staat voor alle 4 stappen
 *   - Laadt een opgeslagen concept uit localStorage bij het openen
 *   - Slaat automatisch op via useAutosave (debounced 600ms)
 *   - Beheert de actieve stap en animatierichting (sliding)
 *   - Valideert elke stap vóór het doorgaan
 *   - Verzendt de calamiteit via POST /api/calamiteiten
 *   - Uploadt foto's via POST /api/calamiteiten/:id/fotos
 *   - Verwijdert het concept na succesvolle indiening
 */

import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { useAuth } from '../../context/AuthContext.jsx';
import { useAutosave, laadConcept, wisConcept } from '../../hooks/useAutosave.js';
import api, { APIFout } from '../../utils/apiClient.js';

import WizardVoortgang   from './WizardVoortgang.jsx';
import Stap1Locatie      from './Stap1Locatie.jsx';
import Stap2CROW         from './Stap2CROW.jsx';
import Stap3Registratie  from './Stap3Registratie.jsx';
import Stap4Fotos        from './Stap4Fotos.jsx';
import SuccesPDFScherm   from './SuccesPDFScherm.jsx';

// ── Beginwaarden formulier ────────────────────────────────────────────────────

const INITIELE_STAAT = {
  // Stap 1: Locatie
  rijksweg:    '',
  hmp:         '',
  rijrichting: 'Oplopend',
  aantalStroken: '1',

  // Stap 2: CROW
  crowResultaten: [],
  crowOverrides:  {},

  // Stap 3: Registratie
  klantId:                  '',
  tijdstipMelding:          '',
  tijdstipAanwezig:         '',
  tijdstipAfgerond:         '',
  collegas:                 [],
  materieel:                [],
  naamInspecteurRws:        '',
  omschrijving:             '',
  restschade:               false,
  restschadeOmschrijving:   '',
  vervolgactie:             false,
  vervolgactieOmschrijving: '',
  checklistPbm:             null,
  checklistFotosCalamiteit: null,
  checklistFotosAanpak:     null,
  checklistVeilig:          null,
  checklistStortbon:        null,

  // Stap 4: Foto's
  fotos: [],
};

// ── Framer Motion varianten voor slide-transitie ──────────────────────────────

const SLIDE_VARIANTEN = {
  initieel: (richting) => ({
    x: richting > 0 ? '100%' : '-100%',
    opacity: 0,
  }),
  zichtbaar: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.32, ease: [0.25, 0.1, 0.25, 1] },
  },
  uitgang: (richting) => ({
    x: richting > 0 ? '-60%' : '60%',
    opacity: 0,
    transition: { duration: 0.22, ease: [0.25, 0.1, 0.25, 1] },
  }),
};

// ── Validatiefuncties per stap ────────────────────────────────────────────────

function valideerStap1(data) {
  const fouten = {};
  if (!data.rijksweg.trim())            fouten.rijksweg    = 'Rijksweg is verplicht.';
  if (!data.hmp)                        fouten.hmp         = 'HMP is verplicht.';
  else if (isNaN(parseFloat(data.hmp))) fouten.hmp         = 'Voer een geldig decimaal getal in.';
  if (!data.rijrichting)                fouten.rijrichting = 'Kies een rijrichting.';
  if (!data.aantalStroken)              fouten.aantalStroken = 'Kies een scenario.';
  return fouten;
}

function valideerStap2(data) {
  const fouten = {};
  if (!data.crowResultaten || data.crowResultaten.length === 0) {
    fouten.crowResultaten = 'Voer eerst de CROW-berekening uit.';
  }
  return fouten;
}

function valideerStap3(data) {
  const fouten = {};
  // klantId is optioneel (onbekende opdrachtgever is toegestaan)
  if (!data.naamInspecteurRws?.trim()) fouten.naamInspecteurRws = 'Naam van de inspecteur is verplicht.';
  if (!data.tijdstipMelding)           fouten.tijdstipMelding   = 'Tijdstip melding is verplicht.';
  if (!data.tijdstipAanwezig)     fouten.tijdstipAanwezig = 'Tijdstip aanwezig is verplicht.';
  if (!data.tijdstipAfgerond)     fouten.tijdstipAfgerond = 'Tijdstip afgerond is verplicht.';
  if (data.tijdstipAanwezig && data.tijdstipMelding &&
      new Date(data.tijdstipAanwezig) < new Date(data.tijdstipMelding)) {
    fouten.tijdstipAanwezig = 'Aanwezig-tijd mag niet vóór meldingstijd liggen.';
  }
  if (data.tijdstipAfgerond && data.tijdstipAanwezig &&
      new Date(data.tijdstipAfgerond) < new Date(data.tijdstipAanwezig)) {
    fouten.tijdstipAfgerond = 'Afgerond-tijd mag niet vóór aanwezig-tijd liggen.';
  }
  if (data.materieel.length === 0) {
    fouten.materieel = 'Voeg minimaal 1 materieelregel toe.';
  } else {
    const onvolledig = data.materieel.some((m) => !m.materieelId);
    if (onvolledig) fouten.materieel = 'Selecteer voor elk item een materieeltype.';
  }
  if (data.checklistPbm             === null) fouten.checklistPbm             = 'Beantwoord deze vraag.';
  if (data.checklistFotosCalamiteit === null) fouten.checklistFotosCalamiteit = 'Beantwoord deze vraag.';
  if (data.checklistFotosAanpak     === null) fouten.checklistFotosAanpak     = 'Beantwoord deze vraag.';
  if (data.checklistVeilig          === null) fouten.checklistVeilig          = 'Beantwoord deze vraag.';
  if (data.checklistStortbon        === null) fouten.checklistStortbon        = 'Beantwoord deze vraag.';
  if (data.restschade && !data.restschadeOmschrijving.trim()) {
    fouten.restschadeOmschrijving = 'Beschrijf de restschade.';
  }
  return fouten;
}

function valideerStap4(data) {
  const fouten = {};
  if (data.fotos.length < 3) {
    fouten.fotos = `Upload minimaal 3 foto's (nu ${data.fotos.length}).`;
  }
  return fouten;
}

const VALIDATORS = [valideerStap1, valideerStap2, valideerStap3, valideerStap4];

// ── WizardPagina ──────────────────────────────────────────────────────────────

export default function WizardPagina() {
  const { gebruiker } = useAuth();

  // ── Formulierstaat ──────────────────────────────────────────────────────
  const [formData, setFormData] = useState(() => {
    // Herstel concept uit localStorage (als beschikbaar)
    const concept = laadConcept();
    if (concept) {
      // fotos zijn niet serialiseerbaar → altijd leeg starten
      return { ...INITIELE_STAAT, ...concept, fotos: [] };
    }
    return INITIELE_STAAT;
  });

  // ── Wizard-navigatie ────────────────────────────────────────────────────
  const [actieveStap, setActieveStap] = useState(0);
  const richting = useRef(1); // 1 = vooruit, -1 = achteruit

  // ── Validatiefouten (zichtbaar na poging tot doorgaan) ──────────────────
  const [fouten, setFouten] = useState({});

  // ── Verzendstatus ───────────────────────────────────────────────────────
  const [isVerzenden,  setIsVerzenden]  = useState(false);
  const [verzendFout,  setVerzendFout]  = useState(null);
  const [isGeslaagd,   setIsGeslaagd]   = useState(false);
  const [calamiteitId, setCalamiteitId] = useState(null);

  // ── Concept-herstel-modal ───────────────────────────────────────────────
  const [toonConceptModal, setToonConceptModal] = useState(
    () => laadConcept() !== null
  );

  // ── Auto-opslaan ────────────────────────────────────────────────────────
  // Fotos worden uitgesloten van opslag (File-objecten zijn niet serialiseerbaar)
  const { fotos: _weggooien, ...opslaanData } = formData;
  useAutosave(opslaanData);

  // ── Veld bijwerken helper ───────────────────────────────────────────────
  const bijwerken = useCallback((veld, waarde) => {
    setFormData((prev) => ({ ...prev, [veld]: waarde }));
    // Wis de fout voor dit veld zodra de gebruiker begint te typen
    setFouten((prev) => {
      if (!prev[veld]) return prev;
      const kopie = { ...prev };
      delete kopie[veld];
      return kopie;
    });
  }, []);

  // ── Stap-navigatie ──────────────────────────────────────────────────────

  function naarVolgendeStap() {
    const stapFouten = VALIDATORS[actieveStap](formData);
    if (Object.keys(stapFouten).length > 0) {
      setFouten(stapFouten);
      // Scrollt naar de eerste fout
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setFouten({});
    richting.current = 1;
    setActieveStap((s) => s + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function naarVorigeStap() {
    setFouten({});
    richting.current = -1;
    setActieveStap((s) => s - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Concept-acties ──────────────────────────────────────────────────────

  function verwerpConcept() {
    setFormData(INITIELE_STAAT);
    wisConcept();
    setToonConceptModal(false);
  }

  function herstelConcept() {
    setToonConceptModal(false);
    // Staat is al hersteld in de initialisatiefunctie
  }

  // ── Verzenden ───────────────────────────────────────────────────────────

  async function verzenden() {
    // Stap 4 validatie
    const stapFouten = valideerStap4(formData);
    if (Object.keys(stapFouten).length > 0) {
      setFouten(stapFouten);
      return;
    }

    setIsVerzenden(true);
    setVerzendFout(null);

    try {
      // ── 1. Calamiteit aanmaken ──────────────────────────────────────
      const postData = {
        rijksweg:               formData.rijksweg,
        hmp:                    parseFloat(formData.hmp),
        rijbaan_richting:       formData.rijrichting,
        aantal_stroken:         parseInt(formData.aantalStroken),
        klant_id:               formData.klantId ? parseInt(formData.klantId) : null,
        tijdstip_melding:       formData.tijdstipMelding,
        tijdstip_aanwezig:      formData.tijdstipAanwezig,
        tijdstip_afgerond:      formData.tijdstipAfgerond,
        omschrijving:                formData.omschrijving || null,
        naam_inspecteur_rws:         formData.naamInspecteurRws || null,
        restschade:                  formData.restschade,
        restschade_omschrijving:     formData.restschadeOmschrijving || null,
        vervolgactie:                formData.vervolgactie,
        vervolgactie_omschrijving:   formData.vervolgactieOmschrijving || null,
        checklist_pbm:               formData.checklistPbm,
        checklist_fotos_calamiteit:  formData.checklistFotosCalamiteit,
        checklist_fotos_aanpak:      formData.checklistFotosAanpak,
        checklist_veilig:            formData.checklistVeilig,
        checklist_stortbon:          formData.checklistStortbon,
        collega_ids:            formData.collegas,
        materieel:              formData.materieel.map((m) => ({
          materieel_id: parseInt(m.materieelId),
          aantal:       m.aantal,
        })),
        crow_overrides: formData.crowOverrides,
      };

      const resultaat = await api.post('/api/calamiteiten', postData);
      const calamiteitId = resultaat.id ?? resultaat.calamiteitId;

      // ── 2. Foto's uploaden ──────────────────────────────────────────
      if (formData.fotos.length > 0 && calamiteitId) {
        const fotoFormData = new FormData();
        formData.fotos.forEach((foto) => {
          fotoFormData.append('fotos', foto.bestand);
        });
        await api.upload(`/api/calamiteiten/${calamiteitId}/fotos`, fotoFormData, calamiteitId);
      }

      // ── 3. Concept wissen en PDF-succescherm tonen ─────────────────
      wisConcept();
      setCalamiteitId(calamiteitId);
      setIsGeslaagd(true);

    } catch (err) {
      if (err instanceof APIFout) {
        setVerzendFout(err.message);
      } else {
        setVerzendFout('Verzending mislukt. Controleer uw verbinding en probeer opnieuw.');
      }
    } finally {
      setIsVerzenden(false);
    }
  }

  // ── PDF-succescherm (na indiening) ────────────────────────────────────────
  if (isGeslaagd && calamiteitId) {
    return <SuccesPDFScherm calamiteitId={calamiteitId} />;
  }

  // ── Concept-herstel-modal ─────────────────────────────────────────────────
  const conceptModal = (
    <AnimatePresence>
      {toonConceptModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-8 bg-black/60 backdrop-blur-sm"
        >
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            className="w-full max-w-sm glas-kaart rounded-3xl p-6 flex flex-col gap-4"
          >
            <div className="text-center">
              <p className="text-2xl mb-2">📋</p>
              <h3 className="text-lg font-bold text-slate-100">Concept gevonden</h3>
              <p className="text-slate-400 text-sm mt-1">
                Er is een niet-ingediend formulier gevonden. Wilt u verdergaan?
              </p>
            </div>
            <button type="button" onClick={herstelConcept} className="knop-primair">
              Verder met concept
            </button>
            <button type="button" onClick={verwerpConcept} className="knop-secondair">
              Nieuw formulier starten
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // ── Navigatieknoppen onderaan ─────────────────────────────────────────────
  const isLaatsteStap = actieveStap === 3;
  const isEersteStap  = actieveStap === 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {conceptModal}

      <div className="flex flex-col gap-0">
        {/* Voortgangsbalk */}
        <WizardVoortgang actieveStap={actieveStap} />

        {/* ── Geanimeerde stap-container ─────────────────────────────── */}
        {/*
          overflow-hidden voorkomt dat de sliding content buiten het scherm
          zichtbaar is tijdens de overgangsanimatie.
        */}
        <div className="overflow-hidden">
          <AnimatePresence mode="wait" custom={richting.current}>
            <motion.div
              key={actieveStap}
              custom={richting.current}
              variants={SLIDE_VARIANTEN}
              initial="initieel"
              animate="zichtbaar"
              exit="uitgang"
            >
              {actieveStap === 0 && (
                <Stap1Locatie
                  formData={formData}
                  bijwerken={bijwerken}
                  fouten={fouten}
                />
              )}
              {actieveStap === 1 && (
                <Stap2CROW
                  formData={formData}
                  bijwerken={bijwerken}
                  fouten={fouten}
                />
              )}
              {actieveStap === 2 && (
                <Stap3Registratie
                  formData={formData}
                  bijwerken={bijwerken}
                  fouten={fouten}
                  huidigeGebruikerId={gebruiker?.id}
                />
              )}
              {actieveStap === 3 && (
                <Stap4Fotos
                  formData={formData}
                  bijwerken={bijwerken}
                  fouten={fouten}
                  isVerzenden={isVerzenden}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── Verzend-foutmelding ────────────────────────────────────── */}
        <AnimatePresence>
          {verzendFout && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mx-0 mt-4 flex items-start gap-2 p-4 bg-status-gevaar/10 border border-status-gevaar/25 rounded-2xl"
            >
              <span className="text-xl">⚠️</span>
              <p className="text-status-gevaar text-sm">{verzendFout}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Navigatieknoppen ──────────────────────────────────────── */}
        <div className={`flex gap-3 mt-6 ${isEersteStap ? 'justify-end' : 'justify-between'}`}>
          {/* Vorige-knop */}
          {!isEersteStap && (
            <motion.button
              type="button"
              onClick={naarVorigeStap}
              whileTap={{ scale: 0.97 }}
              disabled={isVerzenden}
              className="flex items-center gap-2 min-h-[52px] px-6 py-3
                         bg-white/5 border border-white/10 text-slate-300
                         font-semibold rounded-2xl transition-all active:bg-white/10
                         disabled:opacity-40"
            >
              ← Vorige
            </motion.button>
          )}

          {/* Volgende / Verzenden knop */}
          {isLaatsteStap ? (
            <motion.button
              type="button"
              onClick={verzenden}
              disabled={isVerzenden}
              whileTap={{ scale: 0.97 }}
              className="flex-1 flex items-center justify-center gap-2
                         min-h-[56px] px-6 py-3
                         font-bold text-white text-base rounded-2xl
                         transition-all disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, #F97316, #EA580C)',
                boxShadow: '0 4px 20px rgba(249,115,22,0.4)',
              }}
            >
              {isVerzenden ? (
                <>
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                    className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white"
                  />
                  Verzenden…
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                  Calamiteit Indienen
                </>
              )}
            </motion.button>
          ) : (
            <motion.button
              type="button"
              onClick={naarVolgendeStap}
              whileTap={{ scale: 0.97 }}
              className="flex-1 knop-primair"
            >
              Volgende →
            </motion.button>
          )}
        </div>
      </div>
    </>
  );
}
