'use strict';

require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const path       = require('path');

const logger = require('./src/infrastructure/logging/logger');
const {
  foutAfhandeling,
  onOnbehandeldeAfwijzing,
  onOnverwachteUitzondering,
} = require('./src/middleware/foutAfhandeling');

// Globale veiligheidsnethandlers — vangen fouten op die buiten Express vallen
process.on('unhandledRejection', onOnbehandeldeAfwijzing);
process.on('uncaughtException',  onOnverwachteUitzondering);

const app  = express();
const POORT = process.env.PORT || 3001;

// ── Beveiliging & parsing ─────────────────────────────────────────────────────
app.use(helmet());
// origin: true → reflecteert het verzoek-origin terug, waardoor alle domeinen
// (inclusief Vercel previews en mobiele clients) worden toegestaan.
// credentials: true is vereist voor het meesturen van Authorization-headers.
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));

// ── HTTP-request logging (Morgan → Winston) ───────────────────────────────────
app.use(morgan('combined', { stream: { write: (msg) => logger.http(msg.trim()) } }));

// ── Statische uploads ─────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, process.env.UPLOAD_MAP || 'uploads')));

// ── API-routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',         require('./src/controllers/authController'));
app.use('/api/calamiteiten', require('./src/controllers/calamiteitController'));
app.use('/api/gebruikers',   require('./src/controllers/gebruikerController'));
app.use('/api/materieel',    require('./src/controllers/materieelController'));
app.use('/api/klanten',      require('./src/controllers/klantController'));
app.use('/api/configuratie', require('./src/controllers/configuratieController'));
app.use('/api/rekenregels',  require('./src/controllers/rekenregelController'));
app.use('/api/export',       require('./src/controllers/exportController'));

// ── Gezondheidscheck ──────────────────────────────────────────────────────────
app.get('/api/status', (_req, res) => {
  res.json({ status: 'ok', omgeving: process.env.NODE_ENV, tijdstip: new Date().toISOString() });
});

// ── Centrale foutafhandeling (altijd als laatste) ─────────────────────────────
app.use(foutAfhandeling);

// ── Server starten ────────────────────────────────────────────────────────────
app.listen(POORT, () => {
  logger.info(`Calamiteiten App backend actief op poort ${POORT} (${process.env.NODE_ENV})`);
});

module.exports = app;
