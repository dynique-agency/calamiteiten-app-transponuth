'use strict';

const express = require('express');
const { param, query, validationResult } = require('express-validator');

const { verifieerToken, vereistAdmin } = require('../middleware/authMiddleware');
const calamiteitRepo = require('../infrastructure/db/calamiteitRepository');
const GenereerPDF    = require('../usecases/export/GenereerPDF');
const GenereerExcel  = require('../usecases/export/GenereerExcel');

const router = express.Router();
router.use(verifieerToken);

const genereerPDFUC   = new GenereerPDF({ calamiteitRepo });
const genereerExcelUC = new GenereerExcel({ calamiteitRepo });

function cv(req, res) {
  const f = validationResult(req);
  if (!f.isEmpty()) { res.status(400).json({ succes: false, fouten: f.array() }); return false; }
  return true;
}

// ── GET /api/export/pdf/:calamiteitId ─────────────────────────────────────────
/**
 * Genereert en streamt de PDF van één calamiteit.
 * Medewerkers mogen alleen hun eigen dossiers exporteren.
 * Admins mogen alles exporteren.
 */
router.get(
  '/pdf/:calamiteitId',
  [param('calamiteitId').isInt({ min: 1 })],
  async (req, res, next) => {
    if (!cv(req, res)) return;
    try {
      const id         = Number(req.params.calamiteitId);
      const { buffer, bestandsnaam } = await genereerPDFUC.uitvoer(id, {
        inclusiefFotos: req.query.fotos !== 'false',
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${bestandsnaam}"`);
      res.setHeader('Content-Length', buffer.length);
      res.send(buffer);
    } catch (err) { next(err); }
  }
);

// ── GET /api/export/excel ─────────────────────────────────────────────────────
/**
 * Genereert en streamt het Kostenoverzicht als XLSX voor een specifieke week.
 * Verplichte query-parameters: jaar (bijv. 2026) en week (1–53).
 * Alleen beschikbaar voor Admins.
 */
router.get(
  '/excel',
  vereistAdmin,
  [
    query('jaar').isInt({ min: 2020, max: 2099 }).withMessage('Geldig jaar is verplicht (bijv. 2026).'),
    query('week').isInt({ min: 1,    max: 53   }).withMessage('Geldig weeknummer is verplicht (1–53).'),
    query('klant_id').optional().isInt({ min: 1 }),
  ],
  async (req, res, next) => {
    if (!cv(req, res)) return;
    try {
      const jaar = Number(req.query.jaar);
      const week = Number(req.query.week);

      // ── ISO-weekberekening (week begint op maandag, ISO 8601) ──────────────
      // Zoek de maandag van week 1: dat is de maandag die het dichtst bij 4 januari ligt.
      const jan4        = new Date(Date.UTC(jaar, 0, 4));
      const dagVanWeek  = jan4.getUTCDay() || 7;                   // 1=ma … 7=zo
      const maandagWeek1 = new Date(jan4);
      maandagWeek1.setUTCDate(jan4.getUTCDate() - dagVanWeek + 1);

      const startDatum = new Date(maandagWeek1);
      startDatum.setUTCDate(maandagWeek1.getUTCDate() + (week - 1) * 7);

      const eindDatum = new Date(startDatum);
      eindDatum.setUTCDate(startDatum.getUTCDate() + 6);
      eindDatum.setUTCHours(23, 59, 59, 999);

      const { buffer, bestandsnaam } = await genereerExcelUC.uitvoer({
        jaar,
        week,
        startDatum,
        eindDatum,
        klantId: req.query.klant_id ? Number(req.query.klant_id) : undefined,
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${bestandsnaam}"`);
      res.setHeader('Content-Length', buffer.length);
      res.send(buffer);
    } catch (err) { next(err); }
  }
);

module.exports = router;
