'use strict';

const verbinding = require('../db/verbinding');
const logger     = require('./logger');

/**
 * Schrijft een audit-regel naar de Audit_Log tabel.
 *
 * @param {object} opties
 * @param {number|null} opties.gebruikerId  - ID van de uitvoerende gebruiker (null = systeem)
 * @param {'INSERT'|'UPDATE'|'DELETE'} opties.actie
 * @param {string} opties.tabelNaam         - Naam van de gewijzigde tabel
 * @param {string|number} opties.recordId   - PK-waarde van het gewijzigde record
 * @param {object|null} opties.oudeWaarde   - Vorige toestand (null bij INSERT)
 * @param {object|null} opties.nieuweWaarde - Nieuwe toestand (null bij DELETE)
 */
async function schrijfAuditLog({ gebruikerId, actie, tabelNaam, recordId, oudeWaarde, nieuweWaarde }) {
  try {
    const sql = `
      INSERT INTO Audit_Log
        (gebruiker_id, actie, tabel_naam, record_id, oude_waarde, nieuwe_waarde)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    await verbinding.query(sql, [
      gebruikerId  ?? null,
      actie,
      tabelNaam,
      String(recordId),
      oudeWaarde   ? JSON.stringify(oudeWaarde)   : null,
      nieuweWaarde ? JSON.stringify(nieuweWaarde) : null,
    ]);
  } catch (err) {
    // Audit-logging mag de hoofdflow nooit blokkeren
    logger.error('Fout bij schrijven audit-log:', err);
  }
}

module.exports = { schrijfAuditLog };
