'use strict';

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');

const { verifieerToken, vereistAdmin, haalGebruikerIdOp } = require('../middleware/authMiddleware');
const { schrijfAuditLog } = require('../infrastructure/logging/auditLogger');
const rekenregelRepo = require('../infrastructure/db/rekenregelRepository');

const router = express.Router();
router.use(verifieerToken);

function cv(req, res) {
  const f = validationResult(req);
  if (!f.isEmpty()) { res.status(400).json({ succes: false, fouten: f.array() }); return false; }
  return true;
}

// GET /api/rekenregels — alle of gefilterd op stroken
router.get('/',
  [query('stroken').optional().isInt({ min: 1, max: 2 })],
  async (req, res, next) => {
    if (!cv(req, res)) return;
    try {
      const regels = req.query.stroken
        ? await rekenregelRepo.haalOpOpScenario(Number(req.query.stroken))
        : await rekenregelRepo.haalAlleOp();
      res.json({ succes: true, data: regels });
    } catch (err) { next(err); }
  }
);

// POST /api/rekenregels — Admin
router.post('/', vereistAdmin,
  [
    body('scenario_stroken').isInt({ min: 1, max: 2 }),
    body('object_naam').trim().notEmpty().isLength({ max: 150 }),
    body('offset_hmp').isFloat({ min: 0 }),
    body('volgorde').optional().isInt({ min: 0 }),
  ],
  async (req, res, next) => {
    if (!cv(req, res)) return;
    try {
      const gebruikerId = haalGebruikerIdOp(req);
      const nieuwId = await rekenregelRepo.maakAan({
        scenario_stroken: req.body.scenario_stroken,
        object_naam:      req.body.object_naam,
        offset_hmp:       req.body.offset_hmp,
        volgorde:         req.body.volgorde ?? 0,
      });
      await schrijfAuditLog({
        gebruikerId, actie: 'INSERT', tabelNaam: 'Rekenregel',
        recordId: nieuwId, oudeWaarde: null, nieuweWaarde: req.body,
      });
      res.status(201).json({ succes: true, id: nieuwId });
    } catch (err) { next(err); }
  }
);

// PATCH /api/rekenregels/:id — Admin
router.patch('/:id', vereistAdmin,
  [
    param('id').isInt({ min: 1 }),
    body('object_naam').optional().trim().notEmpty().isLength({ max: 150 }),
    body('offset_hmp').optional().isFloat({ min: 0 }),
    body('volgorde').optional().isInt({ min: 0 }),
  ],
  async (req, res, next) => {
    if (!cv(req, res)) return;
    try {
      const id          = Number(req.params.id);
      const gebruikerId = haalGebruikerIdOp(req);
      const [regels]    = await require('../infrastructure/db/verbinding').query(
        'SELECT * FROM Rekenregel WHERE id = ?', [id]
      );
      const bestaand    = regels[0];
      if (!bestaand) return res.status(404).json({ succes: false, fout: 'Rekenregel niet gevonden.' });

      const wijzigingen = {};
      ['object_naam','offset_hmp','volgorde'].forEach((v) => {
        if (req.body[v] !== undefined) wijzigingen[v] = req.body[v];
      });

      await rekenregelRepo.wijzig(id, wijzigingen);
      await schrijfAuditLog({
        gebruikerId, actie: 'UPDATE', tabelNaam: 'Rekenregel',
        recordId: id, oudeWaarde: bestaand, nieuweWaarde: wijzigingen,
      });
      res.json({ succes: true, bericht: 'Rekenregel bijgewerkt.' });
    } catch (err) { next(err); }
  }
);

// DELETE /api/rekenregels/:id — Admin
router.delete('/:id', vereistAdmin, [param('id').isInt({ min: 1 })], async (req, res, next) => {
  if (!cv(req, res)) return;
  try {
    const id          = Number(req.params.id);
    const gebruikerId = haalGebruikerIdOp(req);
    const [regels]    = await require('../infrastructure/db/verbinding').query(
      'SELECT * FROM Rekenregel WHERE id = ?', [id]
    );
    const bestaand    = regels[0];
    if (!bestaand) return res.status(404).json({ succes: false, fout: 'Rekenregel niet gevonden.' });

    await rekenregelRepo.verwijder(id);
    await schrijfAuditLog({
      gebruikerId, actie: 'DELETE', tabelNaam: 'Rekenregel',
      recordId: id, oudeWaarde: bestaand, nieuweWaarde: null,
    });
    res.json({ succes: true, bericht: 'Rekenregel verwijderd.' });
  } catch (err) { next(err); }
});

module.exports = router;
