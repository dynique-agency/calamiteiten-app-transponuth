import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext.jsx';
import api, { APIFout } from '../utils/apiClient.js';

// ── Framer Motion varianten ────────────────────────────────────────────────────

const containerVarianten = {
  initieel: { opacity: 0 },
  zichtbaar: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.1 },
  },
};

const itemVarianten = {
  initieel: { opacity: 0, y: 20 },
  zichtbaar: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] } },
};

// ── Inlogpagina ───────────────────────────────────────────────────────────────

/**
 * InloggenPagina — Premium login-scherm.
 *
 * Stijl:
 *   - Volledig scherm met gelaagde glow-achtergrond
 *   - Glassmorphism formulierkaart
 *   - Subtiele animaties bij laden, fout en succes
 *   - Grote aanraakdoelen voor mobiel
 */
export default function InloggenPagina() {
  const { inloggen, isIngelogd } = useAuth();
  const navigate  = useNavigate();
  const locatie   = useLocation();

  const [naam,       setNaam]       = useState('');
  const [wachtwoord, setWachtwoord] = useState('');
  const [isLadend,   setIsLadend]   = useState(false);
  const [fout,       setFout]       = useState(null);
  const [toonWachtwoord, setToonWachtwoord] = useState(false);

  // Als de gebruiker al ingelogd is → direct doorsturen
  useEffect(() => {
    if (isIngelogd) {
      const returnUrl = locatie.state?.returnUrl || '/';
      navigate(returnUrl, { replace: true });
    }
  }, [isIngelogd, navigate, locatie.state]);

  // ── Formulier afhandelen ──────────────────────────────────────────────────

  async function handleInloggen(e) {
    e.preventDefault();
    setFout(null);

    if (!naam.trim() || !wachtwoord) {
      setFout('Vul uw naam en wachtwoord in.');
      return;
    }

    setIsLadend(true);
    try {
      const data = await api.post('/api/auth/inloggen', { naam: naam.trim(), wachtwoord }, false);
      inloggen(data.token);
      // Navigatie wordt automatisch afgehandeld door de useEffect hierboven
    } catch (err) {
      if (err instanceof APIFout) {
        setFout(err.message);
      } else {
        setFout('Kan geen verbinding maken met de server. Controleer uw internetverbinding.');
      }
    } finally {
      setIsLadend(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-app-bg flex flex-col items-center justify-center px-5 relative overflow-hidden">

      {/* Achtergrond-decoraties (glow-cirkels) */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-merk/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-accent/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-72 h-72 bg-merk-licht/8 rounded-full blur-2xl" />
      </div>

      {/* Formulierkaart */}
      <motion.div
        variants={containerVarianten}
        initial="initieel"
        animate="zichtbaar"
        className="relative w-full max-w-sm"
      >
        {/* Logo */}
        <motion.div variants={itemVarianten} className="flex flex-col items-center mb-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.05 }}
            className="w-20 h-20 rounded-3xl bg-gradient-to-br from-merk to-merk-licht flex items-center justify-center shadow-glas-lg mb-4"
            style={{ boxShadow: '0 8px 32px rgba(26,60,110,0.5), 0 0 0 1px rgba(255,255,255,0.08)' }}
          >
            <span className="text-white font-black text-3xl leading-none">TN</span>
          </motion.div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Transpo-Nuth</h1>
          <p className="text-slate-500 text-sm mt-1">Calamiteiten App — Buitendienst</p>
        </motion.div>

        {/* Kaart */}
        <motion.form
          variants={itemVarianten}
          onSubmit={handleInloggen}
          className="glas-kaart rounded-3xl p-6 flex flex-col gap-5"
          noValidate
        >
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Inloggen</h2>
            <p className="text-slate-500 text-sm mt-0.5">Gebruik uw medewerkersnaam</p>
          </div>

          {/* Foutmelding */}
          <AnimatePresence>
            {fout && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-start gap-2.5 p-3.5 bg-status-gevaar/10 border border-status-gevaar/25 rounded-2xl overflow-hidden"
              >
                <svg className="w-4 h-4 text-status-gevaar mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                </svg>
                <p className="text-status-gevaar text-sm leading-snug">{fout}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Naam-invoer */}
          <div>
            <label htmlFor="naam" className="invoerveld-label">Naam</label>
            <input
              id="naam"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              value={naam}
              onChange={(e) => { setNaam(e.target.value); setFout(null); }}
              placeholder="Bijv. Jan de Vries"
              className="invoerveld"
              disabled={isLadend}
              required
            />
          </div>

          {/* Wachtwoord-invoer */}
          <div>
            <label htmlFor="wachtwoord" className="invoerveld-label">Wachtwoord</label>
            <div className="relative">
              <input
                id="wachtwoord"
                type={toonWachtwoord ? 'text' : 'password'}
                autoComplete="current-password"
                value={wachtwoord}
                onChange={(e) => { setWachtwoord(e.target.value); setFout(null); }}
                placeholder="••••••••"
                className="invoerveld pr-12"
                disabled={isLadend}
                required
              />
              {/* Toon/verberg wachtwoord-knop */}
              <button
                type="button"
                onClick={() => setToonWachtwoord((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1 touch-doelwit"
                aria-label={toonWachtwoord ? 'Wachtwoord verbergen' : 'Wachtwoord tonen'}
              >
                {toonWachtwoord ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Inlog-knop */}
          <motion.button
            type="submit"
            disabled={isLadend}
            whileTap={{ scale: 0.97 }}
            className="knop-primair mt-1"
          >
            {isLadend ? (
              <>
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                  className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white"
                />
                Bezig met inloggen…
              </>
            ) : (
              'Inloggen'
            )}
          </motion.button>
        </motion.form>

        {/* Versie-info */}
        <motion.p
          variants={itemVarianten}
          className="text-center text-slate-600 text-xs mt-6"
        >
          Calamiteiten App v1.0 — Transpo-Nuth BV
        </motion.p>
      </motion.div>
    </div>
  );
}
