/**
 * wizardUi.jsx — Gedeelde UI-primitieven voor de Wizard
 * -------------------------------------------------------
 * Kleine, herbruikbare componenten die in alle stappen worden gebruikt.
 * Geëxporteerd als named exports.
 */

import { motion } from 'framer-motion';

// ── Segmented Control (iOS-stijl keuze tussen 2-3 opties) ─────────────────────

/**
 * @param {{ opties: {waarde:string, label:string}[], waarde:string, onChange:Function }} props
 */
export function SegmentedControl({ opties, waarde, onChange }) {
  return (
    <div className="flex bg-white/5 rounded-2xl p-1 gap-1 border border-white/8">
      {opties.map((optie) => (
        <motion.button
          key={optie.waarde}
          type="button"
          onClick={() => onChange(optie.waarde)}
          animate={{
            backgroundColor: waarde === optie.waarde
              ? 'rgba(249,115,22,1)'
              : 'rgba(255,255,255,0)',
            color: waarde === optie.waarde ? '#ffffff' : '#94a3b8',
          }}
          whileTap={{ scale: 0.96 }}
          transition={{ duration: 0.2 }}
          className="flex-1 py-3 rounded-xl text-sm font-semibold min-h-[44px]"
        >
          {optie.label}
        </motion.button>
      ))}
    </div>
  );
}

// ── Toggle Schakelaar (iOS-stijl aan/uit) ─────────────────────────────────────

/**
 * @param {{ waarde:boolean, onChange:Function, disabled?:boolean }} props
 */
export function ToggleSchakelaar({ waarde, onChange, disabled = false }) {
  return (
    <motion.button
      type="button"
      role="switch"
      aria-checked={waarde}
      onClick={() => !disabled && onChange(!waarde)}
      animate={{ backgroundColor: waarde ? '#F97316' : '#1E293B' }}
      transition={{ duration: 0.25 }}
      className={`relative w-11 h-6 rounded-full border border-white/10 shrink-0
                  ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {/* Bolletje: container w-11=44px, knob w-5=20px, left-[2px]+translate-x-5(20px)=22+20=42px ≤ 44px ✓ */}
      <motion.span
        animate={{ x: waarde ? 20 : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="absolute top-[2px] left-[2px] w-5 h-5 bg-white rounded-full shadow-md"
      />
    </motion.button>
  );
}

// ── Ja/Nee Toggle (voor de veiligheidschecklist) ──────────────────────────────

/**
 * Drie-waarden toggle: null (niet beantwoord), true (Ja), false (Nee).
 * Toont duidelijke Ja/Nee knoppen die één keer moeten worden gekozen.
 *
 * @param {{ waarde:boolean|null, onChange:Function, fout?:string }} props
 */
export function JaNeeToggle({ waarde, onChange, fout }) {
  return (
    <div className="flex gap-2">
      <motion.button
        type="button"
        onClick={() => onChange(true)}
        animate={{
          backgroundColor: waarde === true
            ? 'rgba(34,197,94,0.2)'
            : 'rgba(255,255,255,0.04)',
          borderColor: waarde === true
            ? 'rgba(34,197,94,0.5)'
            : 'rgba(255,255,255,0.1)',
        }}
        whileTap={{ scale: 0.95 }}
        className={`flex-1 py-3 rounded-xl border text-sm font-semibold min-h-[44px]
                    ${waarde === true ? 'text-status-succes' : 'text-slate-400'}`}
      >
        ✓ Ja
      </motion.button>
      <motion.button
        type="button"
        onClick={() => onChange(false)}
        animate={{
          backgroundColor: waarde === false
            ? 'rgba(239,68,68,0.15)'
            : 'rgba(255,255,255,0.04)',
          borderColor: waarde === false
            ? 'rgba(239,68,68,0.4)'
            : 'rgba(255,255,255,0.1)',
        }}
        whileTap={{ scale: 0.95 }}
        className={`flex-1 py-3 rounded-xl border text-sm font-semibold min-h-[44px]
                    ${waarde === false ? 'text-status-gevaar' : 'text-slate-400'}`}
      >
        ✗ Nee
      </motion.button>
      {fout && <span className="sr-only">{fout}</span>}
    </div>
  );
}

// ── Sectie-kop binnen wizard ──────────────────────────────────────────────────

export function WizardSectie({ titel, children, className = '' }) {
  return (
    <div className={`glas-kaart rounded-3xl p-5 flex flex-col gap-4 ${className}`}>
      {titel && (
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider -mb-1">
          {titel}
        </h3>
      )}
      {children}
    </div>
  );
}

// ── Foutmelding ───────────────────────────────────────────────────────────────

export function FoutTekst({ bericht }) {
  if (!bericht) return null;
  return (
    <motion.p
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-status-gevaar text-xs mt-1.5 ml-1 flex items-center gap-1"
    >
      <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
      </svg>
      {bericht}
    </motion.p>
  );
}

// ── Invoerveld met label ──────────────────────────────────────────────────────

export function VeldGroep({ label, fout, children, verplicht = false }) {
  return (
    <div>
      <label className="invoerveld-label">
        {label}
        {verplicht && <span className="text-accent ml-1" aria-hidden>*</span>}
      </label>
      {children}
      <FoutTekst bericht={fout} />
    </div>
  );
}
