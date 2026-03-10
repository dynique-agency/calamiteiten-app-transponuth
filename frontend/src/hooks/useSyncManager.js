import { useCallback, useEffect, useRef, useState } from 'react';
import {
  leesAlleRecords,
  leesViaIndex,
  verwijderRecord,
  telRecords,
} from '../utils/indexedDB.js';

/**
 * =============================================================================
 * useSyncManager — Offline Synchronisatie-hook — Fase 4
 * =============================================================================
 * Beheert de offline/online-wachtrij via IndexedDB.
 *
 * Functionaliteit:
 *   1. Registreert event-listeners voor 'online' / 'offline' browser-events
 *   2. Telt het aantal wachtende aanvragen (voor badge-teller in de navigatie)
 *   3. Verwerkt automatisch de wachtrij zodra de app weer online gaat
 *   4. Verwerkt offline foto's (Base64 → upload) bij het herstellen van verbinding
 *   5. Biedt `syncNu()` voor handmatig starten van de synchronisatie
 *
 * Geretourneerde state:
 *   isOnline          {boolean}   — Huidige verbindingsstatus
 *   wachtrijAantal    {number}    — Aantal API-aanvragen in de wachtrij
 *   offlineFotoAantal {number}    — Aantal offline opgeslagen foto's
 *   isSynchroniserend {boolean}   — True tijdens actieve synchronisatie
 *   syncNu()          {Function}  — Handmatige synchronisatie starten
 *
 * Gebruik:
 *   const { isOnline, wachtrijAantal, syncNu } = useSyncManager();
 * =============================================================================
 */
export default function useSyncManager() {
  const [isOnline,           setIsOnline]           = useState(navigator.onLine);
  const [wachtrijAantal,     setWachtrijAantal]     = useState(0);
  const [offlineFotoAantal,  setOfflineFotoAantal]  = useState(0);
  const [isSynchroniserend,  setIsSynchroniserend]  = useState(false);

  // Ref om dubbele synchronisatie te voorkomen (React StrictMode / meerdere triggers)
  const isActiefRef = useRef(false);

  // ── Tellers bijwerken ─────────────────────────────────────────────────────

  const bijwerkenTellers = useCallback(async () => {
    try {
      const [wachtrij, fotos] = await Promise.all([
        telRecords('syncWachtrij'),
        telRecords('offlineFotos'),
      ]);
      setWachtrijAantal(wachtrij);
      setOfflineFotoAantal(fotos);
    } catch {
      // IndexedDB-fouten mogen de UI niet breken
    }
  }, []);

  // ── Wachtrij verwerken ────────────────────────────────────────────────────

  /**
   * Verwerkt alle aanvragen in de syncWachtrij, oudste eerst.
   * Aanvragen die mislukken worden bewaard voor de volgende poging.
   */
  const verwerkAPIWachtrij = useCallback(async () => {
    const wachtrij = await leesAlleRecords('syncWachtrij');
    if (wachtrij.length === 0) return;

    console.info(`[Sync] Verwerking van ${wachtrij.length} openstaande aanvraag(en)...`);

    for (const item of wachtrij) {
      try {
        const token = localStorage.getItem('calamapp_jwt');
        const headers = { ...(item.headers || {}) };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const antwoord = await fetch(item.url, {
          method:  item.methode,
          headers,
          body:    item.lichaam || undefined,
        });

        if (antwoord.ok || antwoord.status < 500) {
          // Aanvraag verwerkt (ook bij 4xx: niet opnieuw proberen)
          await verwijderRecord('syncWachtrij', item.id);
          console.info(`[Sync] Aanvraag ${item.id} verwerkt (${antwoord.status})`);
        } else {
          console.warn(`[Sync] Aanvraag ${item.id} mislukt (${antwoord.status}), bewaard voor later`);
        }
      } catch (err) {
        // Netwerk-fout tijdens verwerking — stop en probeer later opnieuw
        console.warn('[Sync] Netwerkfout tijdens verwerking:', err.message);
        break;
      }
    }
  }, []);

  /**
   * Verwerkt offline-opgeslagen foto's.
   * Converteert Base64 terug naar Blob en uploadt via de API.
   */
  const verwerkOfflineFotos = useCallback(async () => {
    const fotos = await leesAlleRecords('offlineFotos');
    if (fotos.length === 0) return;

    console.info(`[Sync] Uploaden van ${fotos.length} offline opgeslagen foto('s)...`);

    for (const foto of fotos) {
      try {
        if (!foto.calamiteitId) {
          // Onbekende calamiteit — overslaan
          await verwijderRecord('offlineFotos', foto.id);
          continue;
        }

        // Converteer Base64 terug naar Blob
        const blob    = _base64NaarBlob(foto.base64Data, foto.mimeType);
        const formData = new FormData();
        formData.append('fotos', blob, foto.bestandsnaam || 'foto.jpg');

        const token = localStorage.getItem('calamapp_jwt');
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const antwoord = await fetch(`/api/calamiteiten/${foto.calamiteitId}/fotos`, {
          method: 'POST',
          headers,
          body:   formData,
        });

        if (antwoord.ok) {
          await verwijderRecord('offlineFotos', foto.id);
          console.info(`[Sync] Offline foto ${foto.id} geüpload.`);
        }
      } catch (err) {
        console.warn(`[Sync] Kon offline foto ${foto.id} niet uploaden:`, err.message);
        break;
      }
    }
  }, []);

  /**
   * Hoofdfunctie: verwerkt zowel de API-wachtrij als de offline foto's.
   * Gooit geen fouten — problemen worden gelogd en bewaard.
   */
  const syncNu = useCallback(async () => {
    if (isActiefRef.current || !navigator.onLine) return;

    isActiefRef.current = true;
    setIsSynchroniserend(true);

    try {
      await verwerkAPIWachtrij();
      await verwerkOfflineFotos();
    } catch (err) {
      console.error('[Sync] Onverwachte fout tijdens synchronisatie:', err);
    } finally {
      isActiefRef.current = false;
      setIsSynchroniserend(false);
      await bijwerkenTellers();
    }
  }, [verwerkAPIWachtrij, verwerkOfflineFotos, bijwerkenTellers]);

  // ── Online/offline event-listeners ───────────────────────────────────────

  useEffect(() => {
    function bijOnline() {
      setIsOnline(true);
      console.info('[Sync] Verbinding hersteld — starten synchronisatie...');
      syncNu();
    }

    function bijOffline() {
      setIsOnline(false);
      console.info('[Sync] Verbinding verbroken — offline-modus actief.');
    }

    window.addEventListener('online',  bijOnline);
    window.addEventListener('offline', bijOffline);

    // Auth-uitlog event (afkomstig van apiClient.js bij 401)
    function bijUitloggen() {
      setWachtrijAantal(0);
      setOfflineFotoAantal(0);
    }
    window.addEventListener('calamapp:uitloggen', bijUitloggen);

    // Initiële teller-check
    bijwerkenTellers();

    return () => {
      window.removeEventListener('online',  bijOnline);
      window.removeEventListener('offline', bijOffline);
      window.removeEventListener('calamapp:uitloggen', bijUitloggen);
    };
  }, [syncNu, bijwerkenTellers]);

  return {
    isOnline,
    wachtrijAantal,
    offlineFotoAantal,
    isSynchroniserend,
    syncNu,
    bijwerkenTellers,
  };
}

// ── Privé hulpfuncties ─────────────────────────────────────────────────────────

/**
 * Converteert een Base64 data-URL terug naar een Blob-object.
 *
 * @param {string} base64String - 'data:image/jpeg;base64,/9j/...'
 * @param {string} [mimeType]
 * @returns {Blob}
 */
function _base64NaarBlob(base64String, mimeType = 'image/jpeg') {
  const splitsing = base64String.split(',');
  const base64    = splitsing.length > 1 ? splitsing[1] : splitsing[0];
  const bytes     = atob(base64);
  const buffer    = new Uint8Array(bytes.length);

  for (let i = 0; i < bytes.length; i++) {
    buffer[i] = bytes.charCodeAt(i);
  }

  return new Blob([buffer], { type: mimeType });
}
