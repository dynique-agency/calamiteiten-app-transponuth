'use strict';

const db = require('./verbinding');

async function haalAlleOp() {
  const [rijen] = await db.query('SELECT * FROM Configuratie ORDER BY sleutel');
  return rijen;
}

async function haalOpOpSleutel(sleutel) {
  const [rijen] = await db.query('SELECT * FROM Configuratie WHERE sleutel = ?', [sleutel]);
  return rijen[0] ?? null;
}

async function stelIn(sleutel, waarde) {
  await db.query(
    'INSERT INTO Configuratie (sleutel, waarde) VALUES (?, ?) ON DUPLICATE KEY UPDATE waarde = ?',
    [sleutel, waarde, waarde]
  );
}

module.exports = { haalAlleOp, haalOpOpSleutel, stelIn };
