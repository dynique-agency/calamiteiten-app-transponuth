import { useEffect, useRef } from 'react';

/**
 * =============================================================================
 * useAutosave — Automatisch Opslaan Hook
 * =============================================================================
 * Slaat de wizard-formulierstaat automatisch op in localStorage bij elke
 * wijziging. Gebruikt een debounce van 600ms om te voorkomen dat bij elke
 * toetsaanslag wordt opgeslagen.
 *
 * Gebruik:
 *   useAutosave(formData);                  // slaat op onder standaardsleutel
 *   useAutosave(formData, 'mijn_sleutel');  // slaat op onder eigen sleutel
 * =============================================================================
 */

export const WIZARD_OPSLAG_SLEUTEL = 'calamapp_wizard_concept';
const DEBOUNCE_MS = 600;

/**
 * Hook: slaat de meegegeven state op in localStorage (gedebounced).
 * Opslaan wordt overgeslagen als de staat leeg/initieel is.
 *
 * @param {object} staat        - De huidige formulierstaat
 * @param {string} [sleutel]    - localStorage-sleutel (optioneel)
 */
export function useAutosave(staat, sleutel = WIZARD_OPSLAG_SLEUTEL) {
  // Ref om te tracken of dit de allereerste render is (geen opslag bij initialisatie)
  const isEersteRender = useRef(true);

  useEffect(() => {
    // Eerste render overslaan — de staat is zojuist geladen vanuit localStorage
    if (isEersteRender.current) {
      isEersteRender.current = false;
      return;
    }

    const timer = setTimeout(() => {
      try {
        localStorage.setItem(sleutel, JSON.stringify(staat));
      } catch (err) {
        // Stille mislukking — localStorage kan vol zijn op sommige apparaten
        console.warn('[Autosave] Kon niet opslaan in localStorage:', err.message);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [staat, sleutel]);
}

/**
 * Laadt een eerder opgeslagen wizard-concept uit localStorage.
 * Geeft null terug als er niets is opgeslagen of de data ongeldig is.
 *
 * @param {string} [sleutel]
 * @returns {object|null}
 */
export function laadConcept(sleutel = WIZARD_OPSLAG_SLEUTEL) {
  try {
    const raw = localStorage.getItem(sleutel);
    if (!raw) return null;
    const data = JSON.parse(raw);
    // Basisvalidatie: zorg dat het een object is, geen primitive
    return typeof data === 'object' && data !== null ? data : null;
  } catch {
    return null;
  }
}

/**
 * Verwijdert het opgeslagen concept uit localStorage.
 * Aanroepen na succesvolle indiening of handmatige reset.
 *
 * @param {string} [sleutel]
 */
export function wisConcept(sleutel = WIZARD_OPSLAG_SLEUTEL) {
  localStorage.removeItem(sleutel);
}
