import { motion } from 'framer-motion';

const STAPPEN = ['Locatie', 'CROW', 'Registratie', "Foto's"];

/**
 * WizardVoortgang — Horizontale stappenvoortgangsbalk.
 *
 * Toont 4 genummerde cirkels verbonden door een lijn.
 * Voltooide stappen krijgen een vinkje, de actieve stap is oranje.
 *
 * @param {{ actieveStap: number }} props
 */
export default function WizardVoortgang({ actieveStap }) {
  return (
    <div className="px-4 pt-3 pb-5">
      <div className="flex items-center">
        {STAPPEN.map((naam, index) => {
          const isVoltooid = index < actieveStap;
          const isActief   = index === actieveStap;
          const isLaatste  = index === STAPPEN.length - 1;

          return (
            <div key={naam} className="flex items-center flex-1 last:flex-none">
              {/* ── Stap-cirkel ────────────────────────────────────────── */}
              <div className="flex flex-col items-center gap-1.5">
                <motion.div
                  animate={{
                    backgroundColor: isVoltooid
                      ? '#22C55E'
                      : isActief
                        ? '#F97316'
                        : 'rgba(255,255,255,0.08)',
                    borderColor: isActief
                      ? '#F97316'
                      : isVoltooid
                        ? '#22C55E'
                        : 'rgba(255,255,255,0.12)',
                    scale: isActief ? 1.1 : 1,
                  }}
                  transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                  className="w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0"
                >
                  {isVoltooid ? (
                    // Vinkje-icoon voor voltooide stap
                    <motion.svg
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="w-4 h-4 text-white"
                      fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </motion.svg>
                  ) : (
                    <span className={`text-xs font-bold ${isActief ? 'text-white' : 'text-slate-500'}`}>
                      {index + 1}
                    </span>
                  )}
                </motion.div>

                {/* Stap-naam */}
                <motion.span
                  animate={{
                    color: isActief ? '#F97316' : isVoltooid ? '#22C55E' : '#64748B',
                    fontWeight: isActief ? 600 : 400,
                  }}
                  className="text-[10px] leading-none whitespace-nowrap"
                >
                  {naam}
                </motion.span>
              </div>

              {/* ── Verbindingslijn ──────────────────────────────────── */}
              {!isLaatste && (
                <div className="flex-1 mx-1.5 h-px bg-white/8 relative overflow-hidden -mt-4">
                  <motion.div
                    animate={{ scaleX: isVoltooid ? 1 : 0 }}
                    initial={{ scaleX: 0 }}
                    transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
                    className="absolute inset-0 bg-status-succes origin-left"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
