import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

/**
 * NietGevondenPagina — 404-scherm.
 * Getoond wanneer een route niet bestaat.
 */
export default function NietGevondenPagina() {
  return (
    <div className="min-h-screen bg-app-bg flex flex-col items-center justify-center px-6 text-center gap-6">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        className="text-8xl select-none"
      >
        🚦
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
      >
        <h1 className="text-5xl font-black text-slate-100">404</h1>
        <p className="text-slate-400 mt-2 text-base">Deze pagina bestaat niet.</p>
        <p className="text-slate-600 text-sm mt-1">Controleer de URL of ga terug naar het dashboard.</p>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.35 }}
      >
        <Link to="/" className="knop-primair max-w-[200px]">Naar Dashboard</Link>
      </motion.div>
    </div>
  );
}
