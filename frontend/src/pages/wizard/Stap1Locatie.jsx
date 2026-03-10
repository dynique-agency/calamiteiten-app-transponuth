/**
 * Stap1Locatie.jsx — Wizard stap 1: Locatiegegevens
 * ---------------------------------------------------
 * Velden:
 *   - Rijksweg (tekst, bijv. "A2" of "N325")
 *   - HMP (hectometerpaal, decimaal bijv. "255.100")
 *   - Rijrichting (Oplopend / Aflopend — segmented control)
 *   - Aantal stroken / Scenario (1 / 2 — segmented control)
 */

import { motion } from 'framer-motion';
import { SegmentedControl, VeldGroep, WizardSectie } from './wizardUi.jsx';

const RICHTING_OPTIES = [
  { waarde: 'Oplopend', label: '↑ Oplopend' },
  { waarde: 'Aflopend', label: '↓ Aflopend' },
];

const STROKEN_OPTIES = [
  { waarde: '1', label: '1 Strook' },
  { waarde: '2', label: '2 Stroken' },
];

/**
 * @param {{
 *   formData: object,
 *   bijwerken: Function,
 *   fouten: object
 * }} props
 */
export default function Stap1Locatie({ formData, bijwerken, fouten }) {
  return (
    <motion.div
      className="flex flex-col gap-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.05 }}
    >
      {/* Koptekst */}
      <div className="mb-1">
        <h2 className="text-xl font-bold text-slate-100">Locatie</h2>
        <p className="text-slate-500 text-sm mt-0.5">
          Waar heeft de calamiteit plaatsgevonden?
        </p>
      </div>

      {/* ── Rijksweg + HMP ─────────────────────────────────────────────── */}
      <WizardSectie titel="Wegvak">
        <VeldGroep label="Rijksweg" fout={fouten.rijksweg} verplicht>
          <input
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            placeholder="bijv. A2 of N325"
            value={formData.rijksweg}
            onChange={(e) => bijwerken('rijksweg', e.target.value.toUpperCase())}
            className="invoerveld"
            maxLength={10}
          />
        </VeldGroep>

        <VeldGroep label="Hectometerpaal (HMP)" fout={fouten.hmp} verplicht>
          <input
            type="text"
            inputMode="decimal"
            placeholder="bijv. 255.100"
            value={formData.hmp}
            onChange={(e) => {
              // Alleen cijfers, punt en komma toestaan
              const waarde = e.target.value.replace(',', '.');
              if (/^[0-9]*\.?[0-9]{0,3}$/.test(waarde) || waarde === '') {
                bijwerken('hmp', waarde);
              }
            }}
            className="invoerveld"
          />
          <p className="text-slate-600 text-xs mt-1 ml-1">
            Voer in als decimaal getal (bijv. 255.100)
          </p>
        </VeldGroep>
      </WizardSectie>

      {/* ── Rijrichting ────────────────────────────────────────────────── */}
      <WizardSectie titel="Rijrichting">
        <VeldGroep label="Rijbaan richting" fout={fouten.rijrichting} verplicht>
          <SegmentedControl
            opties={RICHTING_OPTIES}
            waarde={formData.rijrichting}
            onChange={(v) => bijwerken('rijrichting', v)}
          />
        </VeldGroep>

        {/* Toelichting richting */}
        <div className="flex items-start gap-3 p-3 bg-merk/10 border border-merk/20 rounded-2xl">
          <span className="text-xl mt-0.5">ℹ️</span>
          <p className="text-slate-400 text-xs leading-relaxed">
            <strong className="text-slate-300">Oplopend:</strong> HMP-waarden nemen toe in rijrichting (CROW-posities worden afgetrokken).
            <br />
            <strong className="text-slate-300">Aflopend:</strong> HMP-waarden nemen af in rijrichting (CROW-posities worden opgeteld).
          </p>
        </div>
      </WizardSectie>

      {/* ── Scenario (aantal stroken) ────────────────────────────────── */}
      <WizardSectie titel="Scenario">
        <VeldGroep label="Aantal rijstroken" fout={fouten.aantalStroken} verplicht>
          <SegmentedControl
            opties={STROKEN_OPTIES}
            waarde={formData.aantalStroken}
            onChange={(v) => bijwerken('aantalStroken', v)}
          />
        </VeldGroep>

        {/* Visuele uitleg scenario */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { stroken: '1', emoji: '🚗', beschrijving: 'Één rijstrook afgesloten — standaard bebording' },
            { stroken: '2', emoji: '🚗🚗', beschrijving: 'Twee rijstroken afgesloten — uitgebreide bebording' },
          ].map(({ stroken, emoji, beschrijving }) => (
            <motion.button
              key={stroken}
              type="button"
              onClick={() => bijwerken('aantalStroken', stroken)}
              animate={{
                borderColor: formData.aantalStroken === stroken
                  ? 'rgba(249,115,22,0.6)'
                  : 'rgba(255,255,255,0.08)',
                backgroundColor: formData.aantalStroken === stroken
                  ? 'rgba(249,115,22,0.08)'
                  : 'rgba(255,255,255,0.03)',
              }}
              whileTap={{ scale: 0.97 }}
              className="p-3 rounded-2xl border flex flex-col items-center gap-2 text-center"
            >
              <span className="text-2xl">{emoji}</span>
              <span className={`text-xs leading-tight ${formData.aantalStroken === stroken ? 'text-accent' : 'text-slate-500'}`}>
                {beschrijving}
              </span>
            </motion.button>
          ))}
        </div>
      </WizardSectie>
    </motion.div>
  );
}
