/**
 * Stap4Fotos.jsx — Wizard stap 4: Foto's & Afronding
 * ---------------------------------------------------
 * Functionaliteit:
 *   - Foto's toevoegen via camera (capture) of galerij
 *   - Minimaal 3 foto's vereist
 *   - Thumbnailraster met verwijderknop
 *   - Offline-veilig: foto's worden opgeslagen in IndexedDB
 *     als de app offline gaat (via apiClient.js)
 *   - Grote 'Verzenden' knop met laadstatus
 */

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FoutTekst, WizardSectie } from './wizardUi.jsx';

const MIN_FOTOS = 3;
const MAX_BESTAND_MB = 10;
const TOEGESTANE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

// ── Foto thumbnail component ──────────────────────────────────────────────────

function FotoThumbnail({ foto, index, onVerwijder }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    // Maak een tijdelijke object-URL voor de preview
    const url = URL.createObjectURL(foto.bestand);
    setSrc(url);
    return () => URL.revokeObjectURL(url); // Opruimen bij unmount
  }, [foto.bestand]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="relative aspect-square rounded-2xl overflow-hidden bg-white/5 border border-white/8"
    >
      {src && (
        <img
          src={src}
          alt={`Foto ${index + 1}`}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      )}

      {/* Foto-nummerbadge */}
      <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center">
        <span className="text-white text-[10px] font-bold">{index + 1}</span>
      </div>

      {/* Verwijder-knop */}
      <motion.button
        type="button"
        onClick={() => onVerwijder(index)}
        whileTap={{ scale: 0.9 }}
        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-status-gevaar/90
                   flex items-center justify-center text-white text-xs font-bold shadow-md"
        aria-label={`Foto ${index + 1} verwijderen`}
      >
        ×
      </motion.button>

      {/* Offline-badge (als foto wacht op upload) */}
      {foto.offline && (
        <div className="absolute bottom-1 left-1 right-1 bg-yellow-500/80 rounded-lg py-0.5 px-1.5">
          <p className="text-[9px] font-semibold text-white text-center">Offline opgeslagen</p>
        </div>
      )}
    </motion.div>
  );
}

// ── Stap 4 component ──────────────────────────────────────────────────────────

/**
 * @param {{
 *   formData: object,
 *   bijwerken: Function,
 *   fouten: object,
 *   isVerzenden: boolean
 * }} props
 */
export default function Stap4Fotos({ formData, bijwerken, fouten, isVerzenden }) {
  const invoerRef = useRef(null);
  const [verwerkingsFout, setVerwerkingsFout] = useState(null);

  // ── Bestanden toevoegen ───────────────────────────────────────────────────
  async function verwerkBestanden(bestanden) {
    setVerwerkingsFout(null);
    const geldige = [];

    for (const bestand of Array.from(bestanden)) {
      // Type-check
      if (!TOEGESTANE_TYPES.includes(bestand.type)) {
        setVerwerkingsFout(`'${bestand.name}' heeft een ongeldig bestandstype. Gebruik JPEG, PNG of WebP.`);
        continue;
      }
      // Grootte-check
      if (bestand.size > MAX_BESTAND_MB * 1024 * 1024) {
        setVerwerkingsFout(`'${bestand.name}' is te groot (max ${MAX_BESTAND_MB} MB).`);
        continue;
      }
      geldige.push({ bestand, offline: !navigator.onLine });
    }

    if (geldige.length > 0) {
      bijwerken('fotos', [...formData.fotos, ...geldige]);
    }
  }

  function handleInvoerWijziging(e) {
    if (e.target.files?.length > 0) {
      verwerkBestanden(e.target.files);
      // Reset de input zodat dezelfde foto opnieuw kan worden geselecteerd
      e.target.value = '';
    }
  }

  function verwijderFoto(index) {
    bijwerken('fotos', formData.fotos.filter((_, i) => i !== index));
  }

  // ── Drag-and-drop ────────────────────────────────────────────────────────
  function handleDrop(e) {
    e.preventDefault();
    if (e.dataTransfer.files?.length > 0) {
      verwerkBestanden(e.dataTransfer.files);
    }
  }

  function handleDragOver(e) { e.preventDefault(); }

  // ── Voortgangsindicator fotos ─────────────────────────────────────────────
  const aantalFotos  = formData.fotos.length;
  const voortgang    = Math.min(aantalFotos / MIN_FOTOS, 1);
  const isVoldoende  = aantalFotos >= MIN_FOTOS;

  return (
    <div className="flex flex-col gap-4">
      {/* Koptekst */}
      <div className="mb-1">
        <h2 className="text-xl font-bold text-slate-100">Foto's & Afronding</h2>
        <p className="text-slate-500 text-sm mt-0.5">
          Upload minimaal {MIN_FOTOS} foto's van de situatie
        </p>
      </div>

      {/* ── Upload voortgangsbalk ──────────────────────────────────────── */}
      <WizardSectie>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-300">
            Foto's geüpload
          </span>
          <motion.span
            animate={{ color: isVoldoende ? '#22C55E' : '#F97316' }}
            className="text-sm font-bold"
          >
            {aantalFotos} / {MIN_FOTOS}
          </motion.span>
        </div>

        {/* Voortgangsbalk */}
        <div className="h-2 bg-white/6 rounded-full overflow-hidden">
          <motion.div
            animate={{ scaleX: voortgang }}
            initial={{ scaleX: 0 }}
            transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
            className="h-full rounded-full origin-left"
            style={{
              background: isVoldoende
                ? 'linear-gradient(90deg, #22C55E, #4ADE80)'
                : 'linear-gradient(90deg, #F97316, #FB923C)',
            }}
          />
        </div>

        <AnimatePresence>
          {isVoldoende && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-status-succes text-xs text-center"
            >
              ✓ Voldoende foto's toegevoegd
            </motion.p>
          )}
        </AnimatePresence>
        <FoutTekst bericht={fouten.fotos} />
      </WizardSectie>

      {/* ── Foto-raster ───────────────────────────────────────────────── */}
      {aantalFotos > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <AnimatePresence>
            {formData.fotos.map((foto, idx) => (
              <FotoThumbnail
                key={`${foto.bestand?.name}-${idx}`}
                foto={foto}
                index={idx}
                onVerwijder={verwijderFoto}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ── Upload-knop (verborgen input + zichtbaar doel) ───────────── */}
      <input
        ref={invoerRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        onChange={handleInvoerWijziging}
        className="sr-only"
        aria-label="Foto's selecteren"
      />

      {/* Drop-zone / upload-knop */}
      <motion.button
        type="button"
        onClick={() => invoerRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        whileTap={{ scale: 0.98 }}
        className="w-full min-h-[120px] flex flex-col items-center justify-center gap-3
                   border-2 border-dashed border-white/15 rounded-3xl
                   hover:border-accent/40 hover:bg-accent/4
                   transition-all duration-250 text-slate-400"
      >
        <div className="w-12 h-12 rounded-2xl bg-white/6 flex items-center justify-center text-2xl">
          📷
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-slate-300">Camera of galerij</p>
          <p className="text-xs text-slate-500 mt-0.5">JPEG · PNG · WebP · max {MAX_BESTAND_MB} MB</p>
        </div>
      </motion.button>

      {/* Verwerkingsfout */}
      <AnimatePresence>
        {verwerkingsFout && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-2 p-3 bg-status-gevaar/10 border border-status-gevaar/25 rounded-2xl"
          >
            <span className="text-lg">⚠️</span>
            <p className="text-status-gevaar text-sm">{verwerkingsFout}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Offline-melding ───────────────────────────────────────────── */}
      <AnimatePresence>
        {!navigator.onLine && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-3 p-4 bg-yellow-500/8 border border-yellow-500/20 rounded-2xl"
          >
            <span className="text-xl">☁️</span>
            <div>
              <p className="text-yellow-400 text-sm font-semibold">App is offline</p>
              <p className="text-yellow-600 text-xs mt-0.5 leading-relaxed">
                Foto's worden lokaal opgeslagen en automatisch geüpload zodra
                de verbinding is hersteld.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Samenvatting vóór indiening ───────────────────────────────── */}
      <WizardSectie titel="Samenvatting">
        <div className="flex flex-col gap-2">
          {[
            { label: 'Rijksweg',    waarde: formData.rijksweg || '—' },
            { label: 'HMP',         waarde: formData.hmp      || '—' },
            { label: 'Rijrichting', waarde: formData.rijrichting === 'Oplopend' ? 'Rechts (Oplopend)' : formData.rijrichting === 'Aflopend' ? 'Links (Aflopend)' : formData.rijrichting || '—' },
            {
              label: 'Aangemeld VC',
              waarde: formData.tijdAangemeldVc
                ? new Date(formData.tijdAangemeldVc).toLocaleString('nl-NL', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })
                : '—',
            },
            { label: 'Foto\'s',     waarde: `${aantalFotos} stuks` },
            {
              label: 'Checklist',
              waarde: [
                formData.checklistPbm     !== null && (formData.checklistPbm     ? '🦺 PBM ✓' : '🦺 PBM ✗'),
                formData.checklistVeilig  !== null && (formData.checklistVeilig  ? '🔒 Veilig ✓' : '🔒 Veilig ✗'),
                formData.checklistStortbon!== null && (formData.checklistStortbon? '🧾 Stortbon ✓' : '🧾 Stortbon ✗'),
              ].filter(Boolean).join('  ') || '—',
            },
            {
              label: 'Opmerkingen',
              waarde: formData.opmerkingen || '—',
            },
          ].map(({ label, waarde }) => (
            <div key={label} className="flex justify-between items-center py-1.5 border-b border-white/4 last:border-0">
              <span className="text-slate-500 text-sm">{label}</span>
              <span className="text-slate-200 text-sm font-medium text-right max-w-[55%] truncate">
                {waarde}
              </span>
            </div>
          ))}
        </div>
      </WizardSectie>

      {/* ── Laadstatus tijdens verzenden ──────────────────────────────── */}
      <AnimatePresence>
        {isVerzenden && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center gap-3 py-4 glas-kaart rounded-2xl"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
              className="w-5 h-5 rounded-full border-2 border-accent/30 border-t-accent"
            />
            <p className="text-slate-300 text-sm">Calamiteit wordt opgeslagen…</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
