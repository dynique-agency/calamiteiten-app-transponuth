'use strict';

const express = require('express');
const { body, param, validationResult } = require('express-validator');

const { verifieerToken, vereistAdmin, haalGebruikerIdOp } = require('../middleware/authMiddleware');
const { schrijfAuditLog } = require('../infrastructure/logging/auditLogger');
const configuratieRepo = require('../infrastructure/db/configuratieRepository');

const router = express.Router();
router.use(verifieerToken, vereistAdmin);

function cv(req, res) {
  const f = validationResult(req);
  if (!f.isEmpty()) { res.status(400).json({ succes: false, fouten: f.array() }); return false; }
  return true;
}

// GET /api/configuratie — volledige lijst
router.get('/', async (_req, res, next) => {
  try {
    res.json({ succes: true, data: await configuratieRepo.haalAlleOp() });
  } catch (err) { next(err); }
});

// GET /api/configuratie/:sleutel
router.get('/:sleutel', async (req, res, next) => {
  try {
    const config = await configuratieRepo.haalOpOpSleutel(req.params.sleutel);
    if (!config) return res.status(404).json({ succes: false, fout: `Configuratie '${req.params.sleutel}' niet gevonden.` });
    res.json({ succes: true, data: config });
  } catch (err) { next(err); }
});

// PUT /api/configuratie/:sleutel — aanmaken of bijwerken + audit
router.put(
  '/:sleutel',
  [
    param('sleutel').isLength({ min: 1, max: 100 }),
    body('waarde').notEmpty().withMessage('Waarde is verplicht.').isLength({ max: 255 }),
  ],
  async (req, res, next) => {
    if (!cv(req, res)) return;
    try {
      const sleutel     = req.params.sleutel;
      const gebruikerId = haalGebruikerIdOp(req);
      const bestaand    = await configuratieRepo.haalOpOpSleutel(sleutel);

      await configuratieRepo.stelIn(sleutel, req.body.waarde);

      await schrijfAuditLog({
        gebruikerId,
        actie:       bestaand ? 'UPDATE' : 'INSERT',
        tabelNaam:   'configuratie',
        recordId:    sleutel,
        oudeWaarde:  bestaand ? { waarde: bestaand.waarde } : null,
        nieuweWaarde: { waarde: req.body.waarde },
      });

      res.json({ succes: true, sleutel, waarde: req.body.waarde });
    } catch (err) { next(err); }
  }
);

module.exports = router;
