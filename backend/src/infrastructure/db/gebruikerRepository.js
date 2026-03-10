'use strict';

const db = require('./verbinding');

/**
 * Haalt alle gebruikers op (zonder wachtwoord-hash).
 * @returns {Promise<object[]>}
 */
async function haalAlleOp() {
  const [rijen] = await db.query(
    `SELECT id, external_id, naam, rol, actief, aangemaakt_op
     FROM Gebruiker
     ORDER BY naam`
  );
  return rijen;
}

/**
 * Haalt één gebruiker op op basis van ID (zonder wachtwoord-hash).
 * @param {number} id
 * @returns {Promise<object|null>}
 */
async function haalOpOpId(id) {
  const [rijen] = await db.query(
    'SELECT id, external_id, naam, rol, actief FROM Gebruiker WHERE id = ?',
    [id]
  );
  return rijen[0] ?? null;
}

/**
 * Haalt een gebruiker op inclusief wachtwoord_hash — alleen voor authenticatie.
 * @param {string} naam
 * @returns {Promise<object|null>}
 */
async function haalOpOpNaam(naam) {
  const [rijen] = await db.query(
    'SELECT * FROM Gebruiker WHERE naam = ? AND actief = 1',
    [naam]
  );
  return rijen[0] ?? null;
}

/**
 * Zoekt een gebruiker op basis van het YourSoft external_id.
 * Gebruikt bij CSV-import om bestaande medewerkers te matchen.
 * @param {string} externalId
 * @returns {Promise<object|null>}
 */
async function haalOpOpExternalId(externalId) {
  const [rijen] = await db.query(
    'SELECT id, external_id, naam, rol, actief FROM Gebruiker WHERE external_id = ?',
    [externalId]
  );
  return rijen[0] ?? null;
}

/**
 * Maakt een nieuwe gebruiker aan.
 * @param {object} data
 * @returns {Promise<number>} Nieuw ID
 */
async function maakAan(data) {
  const [resultaat] = await db.query('INSERT INTO Gebruiker SET ?', [data]);
  return resultaat.insertId;
}

/**
 * Werkt een bestaande gebruiker bij.
 * @param {number} id
 * @param {object} data
 */
async function wijzig(id, data) {
  await db.query('UPDATE Gebruiker SET ? WHERE id = ?', [data, id]);
}

/**
 * Deactiveert een gebruiker (soft delete — nooit verwijderen wegens referenties).
 * @param {number} id
 */
async function deactiveer(id) {
  await db.query('UPDATE Gebruiker SET actief = 0 WHERE id = ?', [id]);
}

/**
 * Verwerkt één CSV-rij via UPSERT op basis van external_id.
 *
 * Logica (conform business rules YourSoft koppeling):
 *   - external_id bestaat → UPDATE naam, rol en optioneel wachtwoord
 *   - external_id bestaat niet → INSERT nieuwe gebruiker
 *
 * @param {object} rijData - { external_id, naam, wachtwoord_hash, rol }
 * @returns {Promise<{actie: 'aangemaakt'|'bijgewerkt', id: number}>}
 */
async function upsertOpExternalId(rijData) {
  const bestaand = await haalOpOpExternalId(rijData.external_id);

  if (bestaand) {
    // Bijwerken: naam + rol altijd; wachtwoord alleen als meegeleverd
    const wijzigingen = { naam: rijData.naam, rol: rijData.rol };
    if (rijData.wachtwoord_hash) {
      wijzigingen.wachtwoord_hash = rijData.wachtwoord_hash;
    }
    await wijzig(bestaand.id, wijzigingen);
    return { actie: 'bijgewerkt', id: bestaand.id };
  } else {
    const id = await maakAan(rijData);
    return { actie: 'aangemaakt', id };
  }
}

module.exports = {
  haalAlleOp,
  haalOpOpId,
  haalOpOpNaam,
  haalOpOpExternalId,
  maakAan,
  wijzig,
  deactiveer,
  upsertOpExternalId,
};
