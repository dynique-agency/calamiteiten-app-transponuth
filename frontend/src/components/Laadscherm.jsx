import { motion } from 'framer-motion';

/**
 * Laadscherm — Getoond tijdens:
 *   - Initialisatie van de AuthContext (isLadend = true)
 *   - Lazy-loading van pagina-componenten (React Suspense fallback)
 *
 * Stijl: premium pulserende laadindicator op het donkere app-achtergrond.
 *
 * @param {{ volledigeHoogte?: boolean, bericht?: string }} props
 */
export default function Laadscherm({ volledigeHoogte = false, bericht }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-6 bg-app-bg
                  ${volledigeHoogte ? 'min-h-screen' : 'min-h-[60vh]'}`}
    >
      {/* Geanimeerd logo */}
      <motion.div
        animate={{
          scale:   [1, 1.08, 1],
          opacity: [0.7, 1, 0.7],
        }}
        transition={{
          duration: 2,
          repeat:   Infinity,
          ease:     'easeInOut',
        }}
        className="relative"
      >
        {/* Buitenste gloedring */}
        <motion.div
          animate={{ opacity: [0.2, 0.5, 0.2], scale: [1, 1.15, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute inset-0 rounded-3xl bg-accent/25 blur-xl"
        />
        {/* Logo-badge */}
        <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-merk to-merk-licht flex items-center justify-center shadow-glas-lg">
          <span className="text-white font-black text-3xl leading-none select-none">TN</span>
        </div>
      </motion.div>

      {/* Drie pulserende stippen */}
      <div className="flex items-center gap-2">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="w-2 h-2 rounded-full bg-accent"
            animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }}
            transition={{
              duration: 1.2,
              repeat:   Infinity,
              delay:    i * 0.2,
              ease:     'easeInOut',
            }}
          />
        ))}
      </div>

      {/* Optioneel bericht */}
      {bericht && (
        <p className="text-slate-500 text-sm text-center max-w-xs px-4">{bericht}</p>
      )}
    </div>
  );
}
