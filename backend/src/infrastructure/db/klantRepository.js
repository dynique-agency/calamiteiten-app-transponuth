'use strict';

const db = require('./verbinding');

async function haalAlleActiefOp() {
  const [rijen] = await db.query('SELECT * FROM Klant WHERE actief = 1 ORDER BY naam');
  return rijen;
}

async function haalOpOpId(id) {
  const [rijen] = await db.query('SELECT * FROM Klant WHERE id = ?', [id]);
  return rijen[0] ?? null;
}

async function maakAan(data) {
  const [resultaat] = await db.query('INSERT INTO Klant SET ?', [data]);
  return resultaat.insertId;
}

async function wijzig(id, data) {
  await db.query('UPDATE Klant SET ? WHERE id = ?', [data, id]);
}

async function deactiveer(id) {
  await db.query('UPDATE Klant SET actief = 0 WHERE id = ?', [id]);
}

module.exports = { haalAlleActiefOp, haalOpOpId, maakAan, wijzig, deactiveer };
