'use strict';

const mysql  = require('mysql2/promise');
const logger = require('../logging/logger');

const pool = mysql.createPool({
  host:               process.env.DB_HOST      || 'localhost',
  port:               Number(process.env.DB_PORT) || 8889,
  database:           process.env.DB_NAAM      || 'calamiteiten_db',
  user:               process.env.DB_GEBRUIKER || 'root',
  password:           process.env.DB_WACHTWOORD || 'root',
  socketPath:         '/Applications/MAMP/tmp/mysql/mysql.sock', // <--- DE MAMP MAC FIX
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  timezone:           '+01:00',
  charset:            'utf8mb4',
});

// Verbindingstest bij opstarten
pool.getConnection()
  .then((conn) => {
    logger.info('MySQL verbinding succesvol opgezet.');
    conn.release();
  })
  .catch((err) => {
    logger.error('Kon geen verbinding maken met MySQL:', err.message);
    process.exit(1);
  });

/**
 * Voert een callback uit binnen een MySQL-transactie.
 * Bij succes: COMMIT. Bij fout: ROLLBACK + opnieuw gooien.
 *
 * Het callback-argument ontvangt de actieve verbinding (conn).
 * Geef deze conn door aan repository-methoden die transactie-veiligheid vereisen.
 *
 * @template T
 * @param {function(import('mysql2/promise').PoolConnection): Promise<T>} callback
 * @returns {Promise<T>}
 *
 * @example
 * const id = await withTransactie(async (conn) => {
 * const newId = await calamiteitRepo.maakAan(data, conn);
 * await calamiteitRepo.voegMaterieelToe(newId, items, conn);
 * return newId;
 * });
 */
async function withTransactie(callback) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const resultaat = await callback(conn);
    await conn.commit();
    return resultaat;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = pool;
module.exports.withTransactie = withTransactie;