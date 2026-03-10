'use strict';

const express = require('express');
const { body, param, validationResult } = require('express-validator');

const { verifieerToken, vereistAdmin, haalGebruikerIdOp } = require('../middleware/authMiddleware');
const { schrijfAuditLog } = require('../infrastructure/logging/auditLogger');
const klantRepo = require('../infrastructure/db/klantRepository');

const router = express.Router();
router.use(verifieerToken);

function cv(req, res) {
  const f = validationResult(req);
  if (!f.isEmpty()) { res.status(400).json({ succes: false, fouten: f.array() }); return false; }
  return true;
}

// GET /api/klanten
router.get('/', async (_req, res, next) => {
  try {
    res.json({ succes: true, data: await klantRepo.haalAlleActiefOp() });
  } catch (err) { next(err); }
});

// GET /api/klanten/:id
router.get('/:id', [param('id').isInt({ min: 1 })], async (req, res, next) => {
  if (!cv(req, res)) return;
  try {
    const k = await klantRepo.haalOpOpId(Number(req.params.id));
    if (!k) return res.status(404).json({ succes: false, fout: 'Klant niet gevonden.' });
    res.json({ succes: true, data: k });
  } catch (err) { next(err); }
});

// POST /api/klanten — Admin
router.post('/', vereistAdmin,
  [
    body('naam').trim().notEmpty().isLength({ max: 150 }),
    body('email_facturatie').optional().isEmail(),
  ],
  async (req, res, next) => {
    if (!cv(req, res)) return;
    try {
      const gebruikerId = haalGebruikerIdOp(req);
      const nieuwId = await klantRepo.maakAan({
        naam:             req.body.naam,
        adres:            req.body.adres || null,
        email_facturatie: req.body.email_facturatie || null,
        actief:           1,
      });
      await schrijfAuditLog({
        gebruikerId, actie: 'INSERT', tabelNaam: 'Klant',
        recordId: nieuwId, oudeWaarde: null, nieuweWaarde: req.body,
      });
      res.status(201).json({ succes: true, id: nieuwId });
    } catch (err) { next(err); }
  }
);

// PATCH /api/klanten/:id — Admin
router.patch('/:id', vereistAdmin, [param('id').isInt({ min: 1 })], async (req, res, next) => {
  if (!cv(req, res)) return;
  try {
    const id          = Number(req.params.id);
    const gebruikerId = haalGebruikerIdOp(req);
    const bestaand    = await klantRepo.haalOpOpId(id);
    if (!bestaand) return res.status(404).json({ succes: false, fout: 'Klant niet gevonden.' });

    const wijzigingen = {};
    ['naam','adres','email_facturatie','actief'].forEach((v) => {
      if (req.body[v] !== undefined) wijzigingen[v] = req.body[v];
    });

    await klantRepo.wijzig(id, wijzigingen);
    await schrijfAuditLog({
      gebruikerId, actie: 'UPDATE', tabelNaam: 'Klant',
      recordId: id, oudeWaarde: bestaand, nieuweWaarde: wijzigingen,
    });
    res.json({ succes: true, bericht: 'Klant bijgewerkt.' });
  } catch (err) { next(err); }
});

module.exports = router;
