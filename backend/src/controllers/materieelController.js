'use strict';

const express = require('express');
const { body, param, validationResult } = require('express-validator');

const { verifieerToken, vereistAdmin, haalGebruikerIdOp } = require('../middleware/authMiddleware');
const { schrijfAuditLog } = require('../infrastructure/logging/auditLogger');
const materieelRepo = require('../infrastructure/db/materieelRepository');

const router = express.Router();
router.use(verifieerToken);

function cv(req, res) {
  const f = validationResult(req);
  if (!f.isEmpty()) { res.status(400).json({ succes: false, fouten: f.array() }); return false; }
  return true;
}

// GET /api/materieel — beschikbaar voor alle ingelogde gebruikers (voor wizard)
router.get('/', async (_req, res, next) => {
  try {
    const materieel = await materieelRepo.haalAlleActiefOp();
    res.json({ succes: true, data: materieel });
  } catch (err) { next(err); }
});

// GET /api/materieel/:id
router.get('/:id', [param('id').isInt({ min: 1 })], async (req, res, next) => {
  if (!cv(req, res)) return;
  try {
    const m = await materieelRepo.haalOpOpId(Number(req.params.id));
    if (!m) return res.status(404).json({ succes: false, fout: 'Materieel niet gevonden.' });
    res.json({ succes: true, data: m });
  } catch (err) { next(err); }
});

// POST /api/materieel — Admin
router.post('/', vereistAdmin,
  [
    body('naam').trim().notEmpty().isLength({ max: 150 }),
    body('eenheid').trim().notEmpty().isLength({ max: 50 }),
    body('basistarief').isFloat({ min: 0 }),
    body('uurtarief').isFloat({ min: 0 }),
  ],
  async (req, res, next) => {
    if (!cv(req, res)) return;
    try {
      const gebruikerId = haalGebruikerIdOp(req);
      const nieuwId = await materieelRepo.maakAan({
        naam:       req.body.naam,
        eenheid:    req.body.eenheid,
        basistarief: req.body.basistarief,
        uurtarief:  req.body.uurtarief,
        actief:     1,
      });
      await schrijfAuditLog({
        gebruikerId, actie: 'INSERT', tabelNaam: 'Materieel',
        recordId: nieuwId, oudeWaarde: null, nieuweWaarde: req.body,
      });
      res.status(201).json({ succes: true, id: nieuwId });
    } catch (err) { next(err); }
  }
);

// PATCH /api/materieel/:id — Admin
router.patch('/:id', vereistAdmin,
  [
    param('id').isInt({ min: 1 }),
    body('basistarief').optional().isFloat({ min: 0 }),
    body('uurtarief').optional().isFloat({ min: 0 }),
  ],
  async (req, res, next) => {
    if (!cv(req, res)) return;
    try {
      const id          = Number(req.params.id);
      const gebruikerId = haalGebruikerIdOp(req);
      const bestaand    = await materieelRepo.haalOpOpId(id);
      if (!bestaand) return res.status(404).json({ succes: false, fout: 'Materieel niet gevonden.' });

      const wijzigingen = {};
      ['naam','eenheid','basistarief','uurtarief'].forEach((v) => {
        if (req.body[v] !== undefined) wijzigingen[v] = req.body[v];
      });

      await materieelRepo.wijzig(id, wijzigingen);
      await schrijfAuditLog({
        gebruikerId, actie: 'UPDATE', tabelNaam: 'Materieel',
        recordId: id, oudeWaarde: bestaand, nieuweWaarde: wijzigingen,
      });
      res.json({ succes: true, bericht: 'Materieel bijgewerkt.' });
    } catch (err) { next(err); }
  }
);

// DELETE /api/materieel/:id — Admin (soft-delete: deactiveert)
router.delete('/:id', vereistAdmin, [param('id').isInt({ min: 1 })], async (req, res, next) => {
  if (!cv(req, res)) return;
  try {
    const id          = Number(req.params.id);
    const gebruikerId = haalGebruikerIdOp(req);
    const bestaand    = await materieelRepo.haalOpOpId(id);
    if (!bestaand) return res.status(404).json({ succes: false, fout: 'Materieel niet gevonden.' });

    await materieelRepo.deactiveer(id);
    await schrijfAuditLog({
      gebruikerId, actie: 'DELETE', tabelNaam: 'Materieel',
      recordId: id, oudeWaarde: bestaand, nieuweWaarde: { actief: 0 },
    });
    res.json({ succes: true, bericht: 'Materieel gedeactiveerd.' });
  } catch (err) { next(err); }
});

module.exports = router;
