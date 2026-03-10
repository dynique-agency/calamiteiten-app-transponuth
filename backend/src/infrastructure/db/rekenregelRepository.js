'use strict';

const db = require('./verbinding');

async function haalOpOpScenario(aantalStroken) {
  const [rijen] = await db.query(
    'SELECT * FROM rekenregel WHERE scenario_stroken = ? ORDER BY volgorde',
    [aantalStroken]
  );
  return rijen;
}

async function haalAlleOp() {
  const [rijen] = await db.query('SELECT * FROM rekenregel ORDER BY scenario_stroken, volgorde');
  return rijen;
}

async function maakAan(data) {
  const [resultaat] = await db.query('INSERT INTO rekenregel SET ?', [data]);
  return resultaat.insertId;
}

async function wijzig(id, data) {
  await db.query('UPDATE rekenregel SET ? WHERE id = ?', [data, id]);
}

async function verwijder(id) {
  await db.query('DELETE FROM rekenregel WHERE id = ?', [id]);
}

module.exports = { haalOpOpScenario, haalAlleOp, maakAan, wijzig, verwijder };
