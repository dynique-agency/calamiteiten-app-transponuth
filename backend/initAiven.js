'use strict';

/**
 * initAiven.js — Eenmalig database-initialisatiescript voor Aiven (productie)
 * ---------------------------------------------------------------------------
 * Verbindt met de Aiven MySQL-instantie en voert database/init.sql uit.
 * Credentials worden ingelezen via een lokaal .env.aiven bestand (gitignored).
 *
 * Voorbereiding:
 *   Kopieer .env.aiven.example naar .env.aiven en vul de Aiven-gegevens in.
 *
 * Uitvoeren: node initAiven.js
 * Daarna:    dit bestand mag worden verwijderd na succesvolle initialisatie.
 */

// Laad Aiven-specifieke omgevingsvariabelen uit .env.aiven (overschrijft niet bestaande .env)
require('dotenv').config({ path: require('path').join(__dirname, '.env.aiven') });

const mysql = require('mysql2/promise');
const fs    = require('fs');
const path  = require('path');

const AIVEN_CONFIG = {
  host:               process.env.AIVEN_HOST,
  port:               Number(process.env.AIVEN_PORT),
  user:               process.env.AIVEN_USER,
  password:           process.env.AIVEN_PASSWORD,
  database:           process.env.AIVEN_DATABASE || 'defaultdb',
  ssl:                { rejectUnauthorized: false },
  multipleStatements: true,
};

async function initialiseer() {
  // Vroegtijdige validatie: stop als verplichte variabelen ontbreken
  const ontbrekend = ['AIVEN_HOST', 'AIVEN_PORT', 'AIVEN_USER', 'AIVEN_PASSWORD']
    .filter((k) => !process.env[k]);
  if (ontbrekend.length > 0) {
    console.error('❌ Ontbrekende omgevingsvariabelen in .env.aiven:', ontbrekend.join(', '));
    console.error('   Kopieer .env.aiven.example naar .env.aiven en vul de gegevens in.');
    process.exit(1);
  }

  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  Aiven DB Init — Transpo-Nuth Calamiteiten App       ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  console.log(`[1/3] Verbinding maken met Aiven MySQL (${AIVEN_CONFIG.host}:${AIVEN_CONFIG.port})…`);
  const verbinding = await mysql.createConnection(AIVEN_CONFIG);
  console.log('      ✓ Verbinding opgezet.\n');

  try {
    const sqlPad = path.join(__dirname, 'database', 'init.sql');
    console.log(`[2/3] init.sql inlezen (${sqlPad})…`);

    if (!fs.existsSync(sqlPad)) {
      throw new Error(`init.sql niet gevonden op pad: ${sqlPad}`);
    }

    const sqlInhoud = fs.readFileSync(sqlPad, 'utf8');
    console.log('      ✓ SQL-bestand geladen.\n');

    console.log('[3/3] SQL uitvoeren op Aiven-database…');
    await verbinding.query(sqlInhoud);
    console.log('      ✓ Alle tabellen aangemaakt en seeddata ingeladen.\n');

    console.log('══════════════════════════════════════════════════════');
    console.log('  ✅  Aiven database-initialisatie succesvol!');
    console.log('      De productiedatabase is klaar voor gebruik.');
    console.log('══════════════════════════════════════════════════════\n');

  } finally {
    await verbinding.end();
    console.log('Verbinding afgesloten.');
    process.exit(0);
  }
}

initialiseer().catch((err) => {
  console.error('\n❌ Initialisatie mislukt:', err.message);
  process.exit(1);
});
