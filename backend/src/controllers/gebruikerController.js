'use strict';

const express = require('express');
const bcrypt  = require('bcryptjs');
const { body, param, validationResult } = require('express-validator');

const { verifieerToken, vereistAdmin, haalGebruikerIdOp } = require('../middleware/authMiddleware');
const { uploadCSV }       = require('../middleware/uploadMiddleware');
const { schrijfAuditLog } = require('../infrastructure/logging/auditLogger');
const gebruikerRepo       = require('../infrastructure/db/gebruikerRepository');
const ImporteerMedewerkersCSV = require('../usecases/gebruiker/ImporteerMedewerkersCSV');

const router = express.Router();
// Alle routes vereisen een geldig JWT-token.
// Schrijfoperaties (POST/PATCH/DELETE) vereisen bovendien de Admin-rol.
// GET-routes zijn bewust open voor alle ingelogde gebruikers zodat Medewerkers
// de collega-lijst in de wizard kunnen ophalen.
router.use(verifieerToken);

const importeerCSVUC = new ImporteerMedewerkersCSV({ gebruikerRepo, auditLogger: { schrijfAuditLog } });

function controleerValidatie(req, res) {
  const fouten = validationResult(req);
  if (!fouten.isEmpty()) { res.status(400).json({ succes: false, fouten: fouten.array() }); return false; }
  return true;
}

// ── GET /api/gebruikers ───────────────────────────────────────────────────────
router.get('/', async (_req, res, next) => {
  try {
    const gebruikers = await gebruikerRepo.haalAlleOp();
    res.json({ succes: true, data: gebruikers });
  } catch (err) { next(err); }
});

// ── GET /api/gebruikers/:id ───────────────────────────────────────────────────
router.get('/:id', [param('id').isInt({ min: 1 })], async (req, res, next) => {
  if (!controleerValidatie(req, res)) return;
  try {
    const gebruiker = await gebruikerRepo.haalOpOpId(Number(req.params.id));
    if (!gebruiker) return res.status(404).json({ succes: false, fout: 'Gebruiker niet gevonden.' });
    res.json({ succes: true, data: gebruiker });
  } catch (err) { next(err); }
});

// ── POST /api/gebruikers ──────────────────────────────────────────────────────
router.post(
  '/',
  vereistAdmin,
  [
    body('naam').trim().notEmpty().withMessage('Naam is verplicht.').isLength({ max: 150 }),
    body('wachtwoord').isLength({ min: 6 }).withMessage('Wachtwoord min. 6 tekens.'),
    body('rol').isIn(['Admin','Medewerker']).withMessage('Rol moet Admin of Medewerker zijn.'),
    body('external_id').optional({ nullable: true }).isString(),
  ],
  async (req, res, next) => {
    if (!controleerValidatie(req, res)) return;
    try {
      const gebruikerId  = haalGebruikerIdOp(req);
      const wachtwoordHash = await bcrypt.hash(req.body.wachtwoord, 12);
      const nieuwId = await gebruikerRepo.maakAan({
        naam:            req.body.naam,
        wachtwoord_hash: wachtwoordHash,
        rol:             req.body.rol,
        external_id:     req.body.external_id || null,
        actief:          1,
      });
      await schrijfAuditLog({
        gebruikerId, actie: 'INSERT', tabelNaam: 'Gebruiker',
        recordId: nieuwId, oudeWaarde: null,
        nieuweWaarde: { naam: req.body.naam, rol: req.body.rol },
      });
      res.status(201).json({ succes: true, id: nieuwId });
    } catch (err) { next(err); }
  }
);

// ── PATCH /api/gebruikers/:id ─────────────────────────────────────────────────
router.patch(
  '/:id',
  vereistAdmin,
  [
    param('id').isInt({ min: 1 }),
    body('naam').optional().trim().notEmpty().isLength({ max: 150 }),
    body('rol').optional().isIn(['Admin','Medewerker']),
    body('wachtwoord').optional().isLength({ min: 6 }),
    body('actief').optional().isBoolean(),
  ],
  async (req, res, next) => {
    if (!controleerValidatie(req, res)) return;
    try {
      const id           = Number(req.params.id);
      const gebruikerId  = haalGebruikerIdOp(req);
      const bestaand     = await gebruikerRepo.haalOpOpId(id);
      if (!bestaand) return res.status(404).json({ succes: false, fout: 'Gebruiker niet gevonden.' });

      const wijzigingen = {};
      if (req.body.naam    !== undefined) wijzigingen.naam    = req.body.naam;
      if (req.body.rol     !== undefined) wijzigingen.rol     = req.body.rol;
      if (req.body.actief  !== undefined) wijzigingen.actief  = req.body.actief ? 1 : 0;
      if (req.body.wachtwoord) {
        wijzigingen.wachtwoord_hash = await bcrypt.hash(req.body.wachtwoord, 12);
      }

      await gebruikerRepo.wijzig(id, wijzigingen);
      await schrijfAuditLog({
        gebruikerId, actie: 'UPDATE', tabelNaam: 'Gebruiker',
        recordId: id, oudeWaarde: bestaand, nieuweWaarde: wijzigingen,
      });
      res.json({ succes: true, bericht: 'Gebruiker bijgewerkt.' });
    } catch (err) { next(err); }
  }
);

// ── DELETE /api/gebruikers/:id ────────────────────────────────────────────────
router.delete('/:id', vereistAdmin, [param('id').isInt({ min: 1 })], async (req, res, next) => {
  if (!controleerValidatie(req, res)) return;
  try {
    const id          = Number(req.params.id);
    const gebruikerId = haalGebruikerIdOp(req);
    const bestaand    = await gebruikerRepo.haalOpOpId(id);
    if (!bestaand) return res.status(404).json({ succes: false, fout: 'Gebruiker niet gevonden.' });

    await gebruikerRepo.deactiveer(id);
    await schrijfAuditLog({
      gebruikerId, actie: 'DELETE', tabelNaam: 'Gebruiker',
      recordId: id, oudeWaarde: bestaand, nieuweWaarde: { actief: 0 },
    });
    res.json({ succes: true, bericht: 'Gebruiker gedeactiveerd.' });
  } catch (err) { next(err); }
});

// ── POST /api/gebruikers/csv-import ──────────────────────────────────────────
/**
 * Importeert medewerkers vanuit een CSV-bestand.
 * Matcht op external_id — bestaande records worden bijgewerkt.
 */
router.post('/csv-import', vereistAdmin, uploadCSV.single('bestand'), async (req, res, next) => {
  try {
    const gebruikerId = haalGebruikerIdOp(req);

    if (!req.file) {
      return res.status(400).json({ succes: false, fout: 'Geen CSV-bestand ontvangen.' });
    }

    const csvInhoud = req.file.buffer.toString('utf-8');
    const resultaat = await importeerCSVUC.uitvoer(csvInhoud, gebruikerId);

    res.json({ succes: true, ...resultaat });
  } catch (err) { next(err); }
});

module.exports = router;
