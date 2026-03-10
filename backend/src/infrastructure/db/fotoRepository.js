'use strict';

const db = require('./verbinding');

/**
 * Slaat een foto-record op in de database.
 * @param {number} calamiteitId
 * @param {string} bestandsnaam
 * @param {string} padUrl  - Relatief serverpad (bijv. 'uploads/abc123.jpg')
 * @param {object} [conn]
 * @returns {Promise<number>} Nieuw foto-ID
 */
async function slaOp(calamiteitId, bestandsnaam, padUrl, conn = db) {
  const [resultaat] = await conn.query(
    'INSERT INTO Foto (calamiteit_id, bestandsnaam, pad_url) VALUES (?, ?, ?)',
    [calamiteitId, bestandsnaam, padUrl]
  );
  return resultaat.insertId;
}

/**
 * Haalt alle foto's van een calamiteit op.
 * @param {number} calamiteitId
 * @returns {Promise<object[]>}
 */
async function haalOpVoorCalamiteit(calamiteitId) {
  const [rijen] = await db.query(
    'SELECT * FROM Foto WHERE calamiteit_id = ? ORDER BY aangemaakt_op',
    [calamiteitId]
  );
  return rijen;
}

/**
 * Verwijdert één foto-record (het bestand zelf dient apart verwijderd te worden).
 * @param {number} id
 */
async function verwijder(id) {
  await db.query('DELETE FROM Foto WHERE id = ?', [id]);
}

module.exports = { slaOp, haalOpVoorCalamiteit, verwijder };
