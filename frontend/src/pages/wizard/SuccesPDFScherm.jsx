/**
 * SuccesPDFScherm.jsx — PDF-preview & WhatsApp-delen na indiening
 * ================================================================
 * Toont na succesvolle calamiteit-indiening:
 *   1. Een preview van de gegenereerde PDF (via backend /api/export/pdf/:id)
 *   2. Een grote knop om de PDF te delen via de native Web Share API
 *      (op Android opent dit het deelmenu met o.a. WhatsApp)
 *
 * Business rule: "Trigger native WhatsApp share intent"
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api, { APIFout } from '../../utils/apiClient.js';

// ── WhatsApp-icoon (inline SVG) ───────────────────────────────────────────────
function IcoonWhatsApp() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

/**
 * @param {{ calamiteitId: number }} props
 */
export default function SuccesPDFScherm({ calamiteitId }) {
  const navigate = useNavigate();

  const [pdfBlob,      setPdfBlob]      = useState(null);
  const [blobUrl,      setBlobUrl]      = useState(null);
  const [isLadend,     setIsLadend]     = useState(true);
  const [fout,         setFout]         = useState(null);
  const [isDelen,      setIsDelen]       = useState(false);
  const [deelFout,     setDeelFout]     = useState(null);

  // ── PDF ophalen bij mounten ──────────────────────────────────────────────
  useEffect(() => {
    if (!calamiteitId) return;

    let url = null;

    async function laadPDF() {
      try {
        const blob = await api.getBlob(`/api/export/pdf/${calamiteitId}`);
        setPdfBlob(blob);
        const u = URL.createObjectURL(blob);
        setBlobUrl(u);
        url = u;
      } catch (err) {
        if (err instanceof APIFout) {
          setFout(err.message);
        } else {
          setFout('Kon de PDF niet ophalen. Controleer uw verbinding.');
        }
      } finally {
        setIsLadend(false);
      }
    }

    laadPDF();

    // Opruimen bij unmount
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [calamiteitId]);

  // ── Delen via Web Share API ───────────────────────────────────────────────
  async function handleDeelViaWhatsApp() {
    if (!pdfBlob || !calamiteitId) return;

    setIsDelen(true);
    setDeelFout(null);

    try {
      const bestandsnaam = `calamiteit_${String(calamiteitId).padStart(4, '0')}.pdf`;
      const bestand = new File([pdfBlob], bestandsnaam, { type: 'application/pdf' });

      if (navigator.share && navigator.canShare?.({ files: [bestand] })) {
        await navigator.share({
          title: `Calamiteit ${calamiteitId} — Transpo-Nuth`,
          text:  `Calamiteitenrapport ${calamiteitId}`,
          files: [bestand],
        });
        // Succes — geen feedback nodig, de share sheet sluit
      } else if (navigator.share) {
        // Share API ondersteund, maar geen bestanden — gebruik text + fallback
        await navigator.share({
          title: `Calamiteit ${calamiteitId} — Transpo-Nuth`,
          text:  `Calamiteitenrapport ${calamiteitId}. Bekijk de PDF in de app.`,
        });
      } else {
        // Geen Web Share API — fallback: download
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = bestandsnaam;
        a.click();
      }
    } catch (err) {
      // AbortError = gebruiker heeft de share-dialog gesloten — geen fout tonen
      if (err.name === 'AbortError') return;
      setDeelFout(err.message || 'Delen mislukt.');
    } finally {
      setIsDelen(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLadend) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-[60vh] flex flex-col items-center justify-center gap-6 px-4"
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 rounded-full border-2 border-accent/30 border-t-accent"
        />
        <p className="text-slate-400 text-sm">PDF wordt gegenereerd…</p>
      </motion.div>
    );
  }

  if (fout) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center gap-6 px-4 py-8"
      >
        <div className="w-16 h-16 rounded-full bg-status-gevaar/20 flex items-center justify-center text-2xl">
          ⚠️
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-100">PDF niet beschikbaar</h2>
          <p className="text-slate-400 text-sm mt-2">{fout}</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/calamiteiten')}
          className="knop-primair max-w-[200px]"
        >
          Naar dossiers
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="flex flex-col gap-6"
    >
      {/* ── Succes-header ───────────────────────────────────────────────── */}
      <div className="flex flex-col items-center text-center gap-4">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="w-20 h-20 rounded-full bg-status-succes/20 border-2 border-status-succes/40 flex items-center justify-center"
        >
          <svg className="w-10 h-10 text-status-succes" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </motion.div>
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Calamiteit ingediend!</h2>
          <p className="text-slate-400 text-sm mt-2">
            Het rapport is gegenereerd. Deel het via WhatsApp of download het PDF-bestand.
          </p>
        </div>
      </div>

      {/* ── PDF-preview ───────────────────────────────────────────────────────── */}
      <div className="glas-kaart rounded-3xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
          <span className="text-sm font-semibold text-slate-300">PDF-preview</span>
          <a
            href={blobUrl}
            download={`calamiteit_${String(calamiteitId).padStart(4, '0')}.pdf`}
            className="text-xs text-accent font-medium hover:underline"
          >
            Download
          </a>
        </div>
        {/* iframe voor PDF-weergave — op mobiel werkt dit in veel browsers */}
        <div className="h-[280px] bg-slate-900/50">
          <iframe
            src={blobUrl}
            title="PDF-preview"
            className="w-full h-full border-0"
            style={{ minHeight: '280px' }}
          />
        </div>
      </div>

      {/* ── Grote WhatsApp / Deel-knop ─────────────────────────────────────── */}
      <motion.button
        type="button"
        onClick={handleDeelViaWhatsApp}
        disabled={isDelen}
        whileTap={{ scale: 0.97 }}
        className="w-full flex items-center justify-center gap-3 min-h-[52px] px-6 py-4
                   rounded-2xl font-bold text-base text-white
                   transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        style={{
          background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
          boxShadow: '0 4px 20px rgba(37,211,102,0.4)',
        }}
      >
        {isDelen ? (
          <>
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
              className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white"
            />
            Delen…
          </>
        ) : (
          <>
            <IcoonWhatsApp />
            Deel via WhatsApp
          </>
        )}
      </motion.button>

      {/* Fallback: als Web Share niet beschikbaar, toon ook een generieke deelknop */}
      {navigator.share && (
        <span className="text-slate-500 text-xs text-center">
          Op Android opent dit het deelmenu met WhatsApp, e-mail, en meer.
        </span>
      )}

      {/* Deel-foutmelding */}
      <AnimatePresence>
        {deelFout && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-status-gevaar text-sm text-center"
          >
            {deelFout}
          </motion.p>
        )}
      </AnimatePresence>

      {/* ── Secundaire actie: Naar dossiers ───────────────────────────────── */}
      <button
        type="button"
        onClick={() => navigate('/calamiteiten')}
        className="knop-secondair"
      >
        Naar mijn dossiers
      </button>
    </motion.div>
  );
}
