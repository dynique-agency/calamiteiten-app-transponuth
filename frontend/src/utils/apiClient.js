/**
 * =============================================================================
 * API Client — Fase 4
 * =============================================================================
 * Centrale fetch-wrapper die:
 *   1. Automatisch het JWT-token meestuurt via de Authorization-header
 *   2. JSON-antwoorden parseert en foutcodes vertaalt
 *   3. Bij een offline-situatie schrijfoperaties naar de IndexedDB-wachtrij stuurt
 *   4. Bij een verlopen token (401) de gebruiker uitlogt
 *
 * Gebruik:
 *   import api from '@/utils/apiClient';
 *
 *   const data = await api.get('/api/calamiteiten');
 *   const result = await api.post('/api/calamiteiten', wizardData);
 *
 *   // Foto-upload (offline-veilig):
 *   await api.upload('/api/calamiteiten/1/fotos', formData, calamiteitId);
 * =============================================================================
 */

import { schrijfRecord } from './indexedDB.js';

// ── Configuratie ───────────────────────────────────────────────────────────────
const API_BASIS = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}`
  : ''; // Lege string → dev-server proxy pakt /api/* op

// localStorage-sleutel voor het JWT-token (zelfde als in AuthContext)
const TOKEN_SLEUTEL = 'calamapp_jwt';

// ── Hulpfuncties ───────────────────────────────────────────────────────────────

/**
 * Haalt het huidig opgeslagen JWT-token op uit localStorage.
 * @returns {string|null}
 */
function haalTokenOp() {
  return localStorage.getItem(TOKEN_SLEUTEL);
}

/**
 * Bouwt de standaard request-headers op inclusief Bearer-token.
 *
 * @param {boolean} [metInhoud=true] - false voor multipart/form-data (laat Content-Type weg)
 * @returns {HeadersInit}
 */
function bouwHeaders(metInhoud = true) {
  const headers = {};
  if (metInhoud) headers['Content-Type'] = 'application/json';

  const token = haalTokenOp();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  return headers;
}

/**
 * Centrale fout-klasse voor API-fouten.
 * Bevat de HTTP-statuscode en een Nederlandse foutmelding.
 */
export class APIFout extends Error {
  constructor(bericht, statusCode = 0, details = null) {
    super(bericht);
    this.naam       = 'APIFout';
    this.statusCode = statusCode;
    this.details    = details;
  }
}

/**
 * Verwerkt een fetch-response en gooit een APIFout bij niet-2xx statuscodes.
 *
 * @param {Response} antwoord
 * @returns {Promise<any>}
 */
async function verwerkAntwoord(antwoord) {
  // Probeer altijd JSON te parsen voor de foutmelding
  let lichaam;
  try {
    lichaam = await antwoord.json();
  } catch {
    lichaam = null;
  }

  if (!antwoord.ok) {
    // 401: verlopen of ongeldig token → uitloggen (AuthContext luistert naar storage-events)
    if (antwoord.status === 401) {
      localStorage.removeItem(TOKEN_SLEUTEL);
      window.dispatchEvent(new Event('calamapp:uitloggen'));
    }

    const bericht = lichaam?.fout
      || lichaam?.message
      || `Serverfout (${antwoord.status} ${antwoord.statusText})`;

    throw new APIFout(bericht, antwoord.status, lichaam?.fouten ?? null);
  }

  // 204 No Content — geen lichaam te retourneren
  if (antwoord.status === 204) return null;

  return lichaam;
}

// ── Hoofd-aanvraagfunctie ─────────────────────────────────────────────────────

/**
 * Basisaanvraag via de Fetch API.
 * Offline-fallback: schrijfoperaties worden in de wachtrij geplaatst.
 *
 * @param {string} eindpunt       - Relatief pad (bijv. '/api/calamiteiten')
 * @param {RequestInit} opties    - Standaard fetch-opties
 * @param {boolean} [offlineVeilig=false] - True voor aanvragen die de wachtrij mogen gebruiken
 * @returns {Promise<any>}
 */
async function aanvraag(eindpunt, opties = {}, offlineVeilig = false) {
  const url = `${API_BASIS}${eindpunt}`;

  try {
    const antwoord = await fetch(url, opties);
    return await verwerkAntwoord(antwoord);
  } catch (err) {
    // Netwerk-fout (geen verbinding) — offline-veilige aanvragen in wachtrij plaatsen
    if (
      offlineVeilig &&
      (err instanceof TypeError || err.name === 'NetworkError') &&
      !navigator.onLine
    ) {
      await schrijfRecord('syncWachtrij', {
        methode:       opties.method || 'GET',
        url,
        lichaam:       opties.body   || null,
        headers:       opties.headers || {},
        type:          'api',
        tijdstip:      Date.now(),
        aantalPogingen: 0,
      });

      // Geef een synthetisch succes terug zodat de UI door kan gaan
      return { succes: true, offline: true, bericht: 'Aanvraag opgeslagen in de offline wachtrij.' };
    }

    // Gooi de fout opnieuw als het geen netwerk-fout is
    if (err instanceof APIFout) throw err;
    throw new APIFout(err.message || 'Netwerkfout — controleer uw verbinding.', 0);
  }
}

// ── Publieke methoden ─────────────────────────────────────────────────────────

const api = {
  /**
   * GET-aanvraag.
   * @param {string} eindpunt
   * @returns {Promise<any>}
   */
  get(eindpunt) {
    return aanvraag(eindpunt, {
      method:  'GET',
      headers: bouwHeaders(false),
    });
  },

  /**
   * POST-aanvraag met JSON-lichaam.
   * @param {string} eindpunt
   * @param {object} data
   * @param {boolean} [offlineVeilig=true]
   * @returns {Promise<any>}
   */
  post(eindpunt, data, offlineVeilig = true) {
    return aanvraag(eindpunt, {
      method:  'POST',
      headers: bouwHeaders(true),
      body:    JSON.stringify(data),
    }, offlineVeilig);
  },

  /**
   * PATCH-aanvraag met JSON-lichaam.
   * @param {string} eindpunt
   * @param {object} data
   * @returns {Promise<any>}
   */
  patch(eindpunt, data) {
    return aanvraag(eindpunt, {
      method:  'PATCH',
      headers: bouwHeaders(true),
      body:    JSON.stringify(data),
    });
  },

  /**
   * PUT-aanvraag met JSON-lichaam.
   * @param {string} eindpunt
   * @param {object} data
   * @returns {Promise<any>}
   */
  put(eindpunt, data) {
    return aanvraag(eindpunt, {
      method:  'PUT',
      headers: bouwHeaders(true),
      body:    JSON.stringify(data),
    });
  },

  /**
   * DELETE-aanvraag.
   * @param {string} eindpunt
   * @returns {Promise<any>}
   */
  delete(eindpunt) {
    return aanvraag(eindpunt, {
      method:  'DELETE',
      headers: bouwHeaders(false),
    });
  },

  /**
   * GET-aanvraag die een Blob retourneert (bijv. PDF, afbeelding).
   * Gebruikt voor export-endpoints zoals /api/export/pdf/:id.
   *
   * @param {string} eindpunt
   * @returns {Promise<Blob>}
   */
  async getBlob(eindpunt) {
    const url   = `${API_BASIS}${eindpunt}`;
    const token = haalTokenOp();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const antwoord = await fetch(url, { method: 'GET', headers });

    if (!antwoord.ok) {
      if (antwoord.status === 401) {
        localStorage.removeItem(TOKEN_SLEUTEL);
        window.dispatchEvent(new Event('calamapp:uitloggen'));
      }
      let bericht = `Serverfout (${antwoord.status})`;
      try {
        const json = await antwoord.json();
        bericht = json.fout || json.message || bericht;
      } catch { /* geen JSON-body */ }
      throw new APIFout(bericht, antwoord.status);
    }

    return antwoord.blob();
  },

  /**
   * Foto-upload via multipart/form-data.
   * Als de app offline is worden de foto's opgeslagen in IndexedDB (offlineFotos-store).
   *
   * @param {string}   eindpunt
   * @param {FormData} formData
   * @param {number}   [calamiteitId]  - Nodig voor offline-opslag
   * @returns {Promise<any>}
   */
  async upload(eindpunt, formData, calamiteitId = null) {
    // Controleer verbinding vóórdat we proberen te uploaden
    if (!navigator.onLine) {
      // Extraheer foto's als Base64 en sla op in IndexedDB
      const bestanden = formData.getAll('fotos');
      for (const bestand of bestanden) {
        const base64 = await _bestandNaarBase64(bestand);
        await schrijfRecord('offlineFotos', {
          calamiteitId,
          base64Data:  base64,
          mimeType:    bestand.type,
          bestandsnaam: bestand.name,
          tijdstip:    Date.now(),
        });
      }
      return { succes: true, offline: true, bericht: `${bestanden.length} foto('s) opgeslagen voor later uploaden.` };
    }

    // Online: verstuur direct naar de server
    const token   = haalTokenOp();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    // Geen Content-Type instellen — browser doet dit automatisch voor multipart

    return aanvraag(eindpunt, { method: 'POST', headers, body: formData });
  },
};

export default api;

// ── Privé hulpfuncties ─────────────────────────────────────────────────────────

/**
 * Converteert een File-object naar een Base64-string.
 * Gebruikt bij offline foto-opslag.
 *
 * @param {File} bestand
 * @returns {Promise<string>} Base64-string (data:mime/type;base64,...)
 */
function _bestandNaarBase64(bestand) {
  return new Promise((resolve, reject) => {
    const lezer = new FileReader();
    lezer.onload  = (e) => resolve(e.target.result);
    lezer.onerror = (e) => reject(e.target.error);
    lezer.readAsDataURL(bestand);
  });
}
