'use strict';

/**
 * =============================================================================
 * Calamiteit Repository — Fase 3
 * =============================================================================
 * Alle database-operaties voor Calamiteit en de gekoppelde junction-tabellen.
 *
 * Transactie-veiligheid:
 *   Methoden die onderdeel zijn van een multi-stap transactie accepteren een
 *   optionele `conn` parameter. Als conn wordt meegegeven, wordt de query op die
 *   verbinding uitgevoerd. Anders wordt de pool gebruikt (voor enkelvoudige queries).
 *
 * Snapshotting (business rules sectie 3):
 *   voegMaterieelToe() slaat de huidige tarieven op als snapshot in de junction-tabel.
 *   voegToeslagenToe() slaat het huidige weekendtarief op als snapshot.
 *   Historische gegevens veranderen NOOIT wanneer basistarieven worden gewijzigd.
 * =============================================================================
 */

const db = require('./verbinding');

// ── Leesoperaties ─────────────────────────────────────────────────────────────

/**
 * Haalt een gepagineerde lijst van calamiteiten op met klant- en maker-naam.
 *
 * @param {object} [filters]
 * @param {string} [filters.status]    - 'Concept' of 'Ingezonden'
 * @param {number} [filters.klantId]
 * @param {number} [filters.makerId]   - Filtert op de medewerker die aanmaakte
 * @param {string} [filters.rijksweg]
 * @param {number} [filters.limit=50]
 * @param {number} [filters.offset=0]
 * @returns {Promise<object[]>}
 */
async function haalAlleOp({ status, klantId, makerId, rijksweg, startDatum, eindDatum, limit = 50, offset = 0 } = {}) {
  // LEFT JOIN klant zodat calamiteiten met null klant_id (onbekende opdrachtgever) ook worden opgehaald
  let sql = `
    SELECT
      c.*,
      k.naam  AS klant_naam,
      g.naam  AS maker_naam
    FROM calamiteit c
    LEFT JOIN klant     k ON k.id = c.klant_id
    JOIN      gebruiker g ON g.id = c.maker_id
    WHERE 1=1
  `;
  const params = [];

  if (status)     { sql += ' AND c.status = ?';                  params.push(status); }
  if (klantId)    { sql += ' AND c.klant_id = ?';                params.push(klantId); }
  if (makerId)    { sql += ' AND c.maker_id = ?';                params.push(makerId); }
  if (rijksweg)   { sql += ' AND c.rijksweg LIKE ?';             params.push(`%${rijksweg}%`); }
  if (startDatum) { sql += ' AND c.tijdstip_melding >= ?';       params.push(startDatum); }
  if (eindDatum)  { sql += ' AND c.tijdstip_melding <= ?';       params.push(eindDatum); }

  sql += ' ORDER BY c.tijdstip_melding ASC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  const [rijen] = await db.query(sql, params);
  return rijen;
}

/**
 * Haalt één calamiteit op inclusief alle gekoppelde data (voor de detailweergave).
 *
 * @param {number} id
 * @returns {Promise<object|null>}
 */
async function haalVolledigOpId(id) {
  // Hoofdrecord
  const [cal] = await db.query(
    `SELECT c.*, k.naam AS klant_naam, g.naam AS maker_naam
     FROM calamiteit c
     LEFT JOIN klant     k ON k.id = c.klant_id
     JOIN      gebruiker g ON g.id = c.maker_id
     WHERE c.id = ?`,
    [id]
  );
  if (!cal[0]) return null;

  // Ingezet materieel (met snapshot-tarieven)
  const [materieel] = await db.query(
    `SELECT cm.*, m.naam AS materieel_naam, m.eenheid
     FROM calamiteit_materieel cm
     JOIN materieel m ON m.id = cm.materieel_id
     WHERE cm.calamiteit_id = ?`,
    [id]
  );

  // Toeslagen
  const [toeslagen] = await db.query(
    'SELECT * FROM calamiteit_toeslag WHERE calamiteit_id = ?',
    [id]
  );

  // Collega-medewerkers
  const [collegas] = await db.query(
    `SELECT g.id, g.naam
     FROM calamiteit_collega cc
     JOIN gebruiker g ON g.id = cc.gebruiker_id
     WHERE cc.calamiteit_id = ?`,
    [id]
  );

  // CROW-plaatsingen
  const [plaatsingen] = await db.query(
    'SELECT * FROM calamiteit_plaatsing WHERE calamiteit_id = ? ORDER BY volgorde',
    [id]
  );

  // Foto's
  const [fotos] = await db.query(
    'SELECT * FROM foto WHERE calamiteit_id = ? ORDER BY aangemaakt_op',
    [id]
  );

  return { ...cal[0], materieel, toeslagen, collegas, plaatsingen, fotos };
}

/**
 * Haalt alleen het basis-calamiteitsrecord op (zonder junction-data).
 * Gebruikt voor snelle lookups en validaties.
 *
 * @param {number} id
 * @returns {Promise<object|null>}
 */
async function haalOpOpId(id) {
  const [rijen] = await db.query('SELECT * FROM calamiteit WHERE id = ?', [id]);
  return rijen[0] ?? null;
}

// ── Schrijfoperaties (transactie-veilig) ──────────────────────────────────────

/**
 * Maakt een nieuw Calamiteit-record aan.
 *
 * @param {object} data   - Kolom-waarde-map voor de INSERT
 * @param {object} [conn] - Optionele transactieverbinding
 * @returns {Promise<number>} Het nieuwe ID
 */
async function maakAan(data, conn = db) {
  const [resultaat] = await conn.query('INSERT INTO calamiteit SET ?', [data]);
  return resultaat.insertId;
}

/**
 * Koppelt materieel-items aan een calamiteit EN slaat de tarieven op als snapshot.
 * Dit is de implementatie van de Snapshotting-regel uit de business rules (sectie 3).
 *
 * De tarieven (basistarief, uurtarief) worden op dit moment vastgelegd in de
 * junction-tabel. Toekomstige tariefwijzigingen raken deze data NIET.
 *
 * @param {number} calamiteitId
 * @param {Array<{materieelId: number, aantal: number, basistariefSnapshot: number, uurtariefSnapshot: number}>} items
 * @param {object} [conn]
 */
async function voegMaterieelToe(calamiteitId, items, conn = db) {
  if (!items || items.length === 0) return;

  const rijen = items.map((item) => [
    calamiteitId,
    item.materieelId,
    item.aantal,
    item.basistariefSnapshot,  // Snapshot van het basistarief op moment van opslaan
    item.uurtariefSnapshot,    // Snapshot van het uurtarief op moment van opslaan
  ]);

  await conn.query(
    `INSERT INTO calamiteit_materieel
       (calamiteit_id, materieel_id, aantal, gefactureerd_basistarief_snapshot, gefactureerd_uurtarief_snapshot)
     VALUES ?`,
    [rijen]
  );
}

/**
 * Koppelt toeslagregels (weekend, nacht) aan een calamiteit.
 * Het uurtarief wordt als snapshot opgeslagen (zie snapshotting-regel).
 *
 * @param {number} calamiteitId
 * @param {Array<{naamToeslag: string, uurtariefSnapshot: number, aantalUren: number}>} toeslagen
 * @param {object} [conn]
 */
async function voegToeslagenToe(calamiteitId, toeslagen, conn = db) {
  if (!toeslagen || toeslagen.length === 0) return;

  const rijen = toeslagen.map((t) => [
    calamiteitId,
    t.naamToeslag,
    t.uurtariefSnapshot,  // Snapshot van het weekendtarief op moment van opslaan
    t.aantalUren,
  ]);

  await conn.query(
    `INSERT INTO calamiteit_toeslag
       (calamiteit_id, naam_toeslag, uurtarief_snapshot, aantal_uren)
     VALUES ?`,
    [rijen]
  );
}

/**
 * Koppelt collega-medewerkers aan een calamiteit.
 *
 * @param {number} calamiteitId
 * @param {number[]} gebruikerIds
 * @param {object} [conn]
 */
async function voegCollegasToe(calamiteitId, gebruikerIds, conn = db) {
  if (!gebruikerIds || gebruikerIds.length === 0) return;

  const rijen = gebruikerIds.map((uid) => [calamiteitId, uid]);
  await conn.query(
    'INSERT INTO calamiteit_collega (calamiteit_id, gebruiker_id) VALUES ?',
    [rijen]
  );
}

/**
 * Slaat de definitieve CROW-objectplaatsingen op.
 * De `is_handmatig`-vlag geeft aan of de positie handmatig is overschreven.
 *
 * @param {number} calamiteitId
 * @param {Array<{objectNaam: string, hmpPositie: number, isHandmatig: boolean, volgorde: number}>} plaatsingen
 * @param {object} [conn]
 */
async function voegPlaatsingenToe(calamiteitId, plaatsingen, conn = db) {
  if (!plaatsingen || plaatsingen.length === 0) return;

  const rijen = plaatsingen.map((p) => [
    calamiteitId,
    p.objectNaam,
    p.hmpPositie,
    p.isHandmatig ? 1 : 0,
    p.volgorde ?? 0,
  ]);

  await conn.query(
    `INSERT INTO calamiteit_plaatsing
       (calamiteit_id, object_naam, hmp_positie, is_handmatig, volgorde)
     VALUES ?`,
    [rijen]
  );
}

// ── Bijwerkoperaties ──────────────────────────────────────────────────────────

/**
 * Werkt basis-velden van een calamiteit bij (voor de admin correctiemodus).
 *
 * @param {number} id
 * @param {object} data
 * @param {object} [conn]
 */
async function wijzig(id, data, conn = db) {
  await conn.query('UPDATE calamiteit SET ? WHERE id = ?', [data, id]);
}

/**
 * Verwijdert alle materieel-koppelingen van een calamiteit (voor correctie-doeleinden).
 *
 * @param {number} calamiteitId
 * @param {object} [conn]
 */
async function verwijderMaterieel(calamiteitId, conn = db) {
  await conn.query('DELETE FROM calamiteit_materieel WHERE calamiteit_id = ?', [calamiteitId]);
}

/**
 * Verwijdert alle toeslagen van een calamiteit.
 *
 * @param {number} calamiteitId
 * @param {object} [conn]
 */
async function verwijderToeslagen(calamiteitId, conn = db) {
  await conn.query('DELETE FROM calamiteit_toeslag WHERE calamiteit_id = ?', [calamiteitId]);
}

/**
 * Verwijdert alle CROW-plaatsingen van een calamiteit.
 *
 * @param {number} calamiteitId
 * @param {object} [conn]
 */
async function verwijderPlaatsingen(calamiteitId, conn = db) {
  await conn.query('DELETE FROM calamiteit_plaatsing WHERE calamiteit_id = ?', [calamiteitId]);
}

/**
 * Verwijdert alle collega-koppelingen van een calamiteit.
 *
 * @param {number} calamiteitId
 * @param {object} [conn]
 */
async function verwijderCollegas(calamiteitId, conn = db) {
  await conn.query('DELETE FROM calamiteit_collega WHERE calamiteit_id = ?', [calamiteitId]);
}

module.exports = {
  haalAlleOp,
  haalOpOpId,
  haalVolledigOpId,
  maakAan,
  voegMaterieelToe,
  voegToeslagenToe,
  voegCollegasToe,
  voegPlaatsingenToe,
  wijzig,
  verwijderMaterieel,
  verwijderToeslagen,
  verwijderPlaatsingen,
  verwijderCollegas,
};
