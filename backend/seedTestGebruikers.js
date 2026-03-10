'use strict';

/**
 * seedTestGebruikers.js — Tijdelijk seed-script
 * ------------------------------------------------
 * Voegt twee testgebruikers toe aan de database.
 * Gebruikt INSERT ... ON DUPLICATE KEY UPDATE zodat het script
 * meerdere keren veilig uitgevoerd kan worden (idempotent op external_id).
 *
 * Uitvoeren vanuit de /backend map:
 *   node seedTestGebruikers.js
 */

require('dotenv').config();
const mysql  = require('mysql2/promise');
const bcrypt = require('bcryptjs');

// ── Databaseverbinding (zelfde instellingen als verbinding.js) ────────────────
const verbindingConfig = {
  host:       process.env.DB_HOST       || 'localhost',
  port:       Number(process.env.DB_PORT) || 8889,
  database:   process.env.DB_NAAM       || 'calamiteiten_db',
  user:       process.env.DB_GEBRUIKER  || 'root',
  password:   process.env.DB_WACHTWOORD || 'root',
  socketPath: '/Applications/MAMP/tmp/mysql/mysql.sock',
  charset:    'utf8mb4',
};

// ── Te seeden gebruikers ──────────────────────────────────────────────────────
const TESTGEBRUIKERS = [
  {
    naam:        'Admin Siem',
    external_id: 'A001',
    wachtwoord:  'Welkom123',
    rol:         'Admin',
    actief:      1,
  },
  {
    naam:        'Chauffeur Marcel',
    external_id: 'C001',
    wachtwoord:  'Welkom123',
    rol:         'Medewerker',
    actief:      1,
  },
];

// ── Hoofdfunctie ──────────────────────────────────────────────────────────────
async function seed() {
  let conn;

  try {
    console.log('🔌  Verbinding maken met database...');
    conn = await mysql.createConnection(verbindingConfig);
    console.log('✅  Verbinding geslaagd.\n');

    // Eenmalig wachtwoord hashen (beide gebruikers delen hetzelfde wachtwoord)
    const ZOUT_RONDES = 10;
    console.log(`🔒  Wachtwoord 'Welkom123' hashen (${ZOUT_RONDES} rondes)...`);
    const wachtwoordHash = await bcrypt.hash('Welkom123', ZOUT_RONDES);
    console.log('✅  Hash gegenereerd.\n');

    // ── UPSERT per gebruiker ──────────────────────────────────────────────────
    // ON DUPLICATE KEY UPDATE op de UNIQUE-index van external_id:
    //   - Bestaat de external_id al? → bijwerken (naam, hash, rol, actief)
    //   - Bestaat de external_id nog niet? → nieuw record invoegen
    const sql = `
      INSERT INTO gebruiker (external_id, naam, wachtwoord_hash, rol, actief)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        naam             = VALUES(naam),
        wachtwoord_hash  = VALUES(wachtwoord_hash),
        rol              = VALUES(rol),
        actief           = VALUES(actief)
    `;

    for (const gebruiker of TESTGEBRUIKERS) {
      const [resultaat] = await conn.execute(sql, [
        gebruiker.external_id,
        gebruiker.naam,
        wachtwoordHash,
        gebruiker.rol,
        gebruiker.actief,
      ]);

      // affectedRows = 1 → nieuw ingevoegd, 2 → bijgewerkt, 0 → geen wijziging
      const actie = resultaat.affectedRows === 1 ? 'Aangemaakt' : 'Bijgewerkt';
      console.log(`👤  ${actie}: ${gebruiker.naam} (${gebruiker.rol}) — external_id: ${gebruiker.external_id}`);
    }

    console.log('\n🎉  Seed voltooid. Beide gebruikers staan klaar in de database.');
    console.log('    Inloggen met: naam = <hierboven> | wachtwoord = Welkom123\n');

  } catch (err) {
    console.error('\n❌  Fout tijdens seeden:', err.message);
    if (err.code) console.error('    MySQL-code:', err.code);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

seed();
