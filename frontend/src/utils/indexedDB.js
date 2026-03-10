/**
 * =============================================================================
 * IndexedDB Wrapper — Fase 4
 * =============================================================================
 * Abstractie-laag bovenop de browser-native IndexedDB API.
 * Zet callback-gebaseerde IndexedDB-aanroepen om naar Promises.
 *
 * Database: 'CalamSync' (versie 2)
 *
 * Object stores:
 *   syncWachtrij   — API-aanvragen die in de wachtrij staan terwijl offline
 *   offlineFotos   — Base64-gecodeerde foto's tijdelijk opgeslagen als offline
 *
 * Gebruik:
 *   const db = await openDB();
 *   await schrijfRecord('offlineFotos', { calamiteitId: 1, base64Data: '...', ... });
 *   const fotos = await leesAlleRecords('offlineFotos');
 *   await verwijderRecord('offlineFotos', id);
 * =============================================================================
 */

const DB_NAAM    = 'CalamSync';
const DB_VERSIE  = 2;

// ── Database openen / aanmaken ────────────────────────────────────────────────

/**
 * Opent de IndexedDB-database en maakt de object stores aan indien nodig.
 * Hergebruikt de bestaande verbinding als deze al is geopend.
 *
 * @returns {Promise<IDBDatabase>}
 */
export function openDB() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB wordt niet ondersteund door deze browser.'));
      return;
    }

    const verzoek = window.indexedDB.open(DB_NAAM, DB_VERSIE);

    // Aanmaken of upgraden van de database (wordt éénmalig uitgevoerd)
    verzoek.onupgradeneeded = (event) => {
      const db = event.target.result;

      // ── Store 1: syncWachtrij ──────────────────────────────────────────────
      // Bewaar API-aanvragen die verzonden moeten worden zodra er weer verbinding is.
      if (!db.objectStoreNames.contains('syncWachtrij')) {
        const store = db.createObjectStore('syncWachtrij', {
          keyPath:       'id',
          autoIncrement: true,
        });
        // Index op tijdstip voor gesorteerde verwerking (oudste eerst)
        store.createIndex('tijdstip', 'tijdstip', { unique: false });
        // Index op type voor gefilterd ophalen (bijv. alleen 'fotoUpload')
        store.createIndex('type', 'type', { unique: false });
      }

      // ── Store 2: offlineFotos ──────────────────────────────────────────────
      // Sla Base64-gecodeerde foto's tijdelijk op als de app offline is.
      // Business rule: foto's worden na succesvolle sync verwijderd.
      if (!db.objectStoreNames.contains('offlineFotos')) {
        const fotoStore = db.createObjectStore('offlineFotos', {
          keyPath:       'id',
          autoIncrement: true,
        });
        // Index voor het ophalen van alle foto's van één calamiteit
        fotoStore.createIndex('calamiteitId', 'calamiteitId', { unique: false });
      }
    };

    verzoek.onsuccess  = (event) => resolve(event.target.result);
    verzoek.onerror    = (event) => reject(event.target.error);
    verzoek.onblocked  = ()      => reject(new Error('IndexedDB-verbinding geblokkeerd door een andere tab.'));
  });
}

// ── CRUD-functies ─────────────────────────────────────────────────────────────

/**
 * Schrijft één record naar een object store.
 *
 * @param {string}  storeNaam  - Naam van de object store
 * @param {object}  record     - Het op te slaan object (zonder id bij autoIncrement)
 * @returns {Promise<number>}  - Het nieuw gegenereerde ID
 */
export async function schrijfRecord(storeNaam, record) {
  const db  = await openDB();
  return new Promise((resolve, reject) => {
    const transactie = db.transaction(storeNaam, 'readwrite');
    const store      = transactie.objectStore(storeNaam);
    const verzoek    = store.add(record);
    verzoek.onsuccess = (event) => resolve(event.target.result);
    verzoek.onerror   = (event) => reject(event.target.error);
  });
}

/**
 * Haalt alle records uit een object store op (gesorteerd op insertievolgorde).
 *
 * @param {string} storeNaam
 * @returns {Promise<object[]>}
 */
export async function leesAlleRecords(storeNaam) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transactie = db.transaction(storeNaam, 'readonly');
    const store      = transactie.objectStore(storeNaam);
    const verzoek    = store.getAll();
    verzoek.onsuccess = (event) => resolve(event.target.result);
    verzoek.onerror   = (event) => reject(event.target.error);
  });
}

/**
 * Haalt records op via een index (bijv. alle foto's van één calamiteit).
 *
 * @param {string} storeNaam
 * @param {string} indexNaam
 * @param {*}      sleutelWaarde
 * @returns {Promise<object[]>}
 */
export async function leesViaIndex(storeNaam, indexNaam, sleutelWaarde) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transactie = db.transaction(storeNaam, 'readonly');
    const store      = transactie.objectStore(storeNaam);
    const index      = store.index(indexNaam);
    const verzoek    = index.getAll(sleutelWaarde);
    verzoek.onsuccess = (event) => resolve(event.target.result);
    verzoek.onerror   = (event) => reject(event.target.error);
  });
}

/**
 * Verwijdert één record op basis van primaire sleutel.
 *
 * @param {string} storeNaam
 * @param {number} id
 * @returns {Promise<void>}
 */
export async function verwijderRecord(storeNaam, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transactie = db.transaction(storeNaam, 'readwrite');
    const store      = transactie.objectStore(storeNaam);
    const verzoek    = store.delete(id);
    verzoek.onsuccess = () => resolve();
    verzoek.onerror   = (event) => reject(event.target.error);
  });
}

/**
 * Wist alle records uit een object store.
 * Gebruikt na een succesvolle synchronisatie.
 *
 * @param {string} storeNaam
 * @returns {Promise<void>}
 */
export async function wisStore(storeNaam) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transactie = db.transaction(storeNaam, 'readwrite');
    const store      = transactie.objectStore(storeNaam);
    const verzoek    = store.clear();
    verzoek.onsuccess = () => resolve();
    verzoek.onerror   = (event) => reject(event.target.error);
  });
}

/**
 * Telt het aantal records in een object store.
 * Gebruikt om de badge-teller op de navigatie bij te werken.
 *
 * @param {string} storeNaam
 * @returns {Promise<number>}
 */
export async function telRecords(storeNaam) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transactie = db.transaction(storeNaam, 'readonly');
    const store      = transactie.objectStore(storeNaam);
    const verzoek    = store.count();
    verzoek.onsuccess = (event) => resolve(event.target.result);
    verzoek.onerror   = (event) => reject(event.target.error);
  });
}
