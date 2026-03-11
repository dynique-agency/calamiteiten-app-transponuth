'use strict';

const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const path    = require('path');

const { verifieerToken, vereistAdmin, haalGebruikerIdOp } = require('../middleware/authMiddleware');
const { uploadFotos }   = require('../middleware/uploadMiddleware');
const { schrijfAuditLog } = require('../infrastructure/logging/auditLogger');

const calamiteitRepo  = require('../infrastructure/db/calamiteitRepository');
const materieelRepo   = require('../infrastructure/db/materieelRepository');
const rekenregelRepo  = require('../infrastructure/db/rekenregelRepository');
const configuratieRepo= require('../infrastructure/db/configuratieRepository');
const fotoRepo        = require('../infrastructure/db/fotoRepository');
const auditLogger     = { schrijfAuditLog };

const MaakCalamiteit  = require('../usecases/calamiteit/MaakCalamiteit');
const WijzigCalamiteit= require('../usecases/calamiteit/WijzigCalamiteit');

const router = express.Router();
router.use(verifieerToken);

// ── Gedeelde use-case instanties (dependency injection) ───────────────────────
const maakCalamiteitUC = new MaakCalamiteit({
  calamiteitRepo, materieelRepo, rekenregelRepo, configuratieRepo, auditLogger,
});
const wijzigCalamiteitUC = new WijzigCalamiteit({
  calamiteitRepo, materieelRepo, rekenregelRepo, configuratieRepo, auditLogger,
});

// ── Validatie-helpers ─────────────────────────────────────────────────────────

function controleerValidatie(req, res) {
  const fouten = validationResult(req);
  if (!fouten.isEmpty()) {
    res.status(400).json({ succes: false, fouten: fouten.array() });
    return false;
  }
  return true;
}

// ── GET /api/calamiteiten ─────────────────────────────────────────────────────
/**
 * Geeft een gepagineerde lijst van calamiteiten terug.
 * Medewerkers zien alleen hun eigen calamiteiten.
 * Admins zien alles.
 */
router.get(
  '/',
  [
    query('status').optional().isIn(['Concept','Ingezonden']),
    query('klant_id').optional().isInt({ min: 1 }),
    query('rijksweg').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 200 }),
    query('offset').optional().isInt({ min: 0 }),
  ],
  async (req, res, next) => {
    if (!controleerValidatie(req, res)) return;
    try {
      const gebruikerId = haalGebruikerIdOp(req);
      const isAdmin     = req.gebruiker.rol === 'Admin';

      const filters = {
        status:   req.query.status,
        klantId:  req.query.klant_id ? Number(req.query.klant_id) : undefined,
        // Medewerkers zien alleen hun eigen dossiers
        makerId:  isAdmin ? undefined : gebruikerId,
        rijksweg: req.query.rijksweg,
        limit:    req.query.limit  ? Number(req.query.limit)  : 50,
        offset:   req.query.offset ? Number(req.query.offset) : 0,
      };

      const calamiteiten = await calamiteitRepo.haalAlleOp(filters);
      res.json({ succes: true, data: calamiteiten, aantal: calamiteiten.length });
    } catch (err) { next(err); }
  }
);

// ── GET /api/calamiteiten/crow-berekening ─────────────────────────────────────
/**
 * Berekent de CROW-plaatsingen live (preview voor de wizard) zonder op te slaan.
 *
 * BELANGRIJK: deze route MOET vóór GET /:id staan. Express matcht routes op
 * volgorde van definitie; als /:id eerder staat, wordt 'crow-berekening' als
 * id-parameter gezien en faalt de isInt()-validatie met een 400.
 */
router.get(
  '/crow-berekening',
  [
    query('hmp').isFloat({ min: 0 }),
    query('richting').isIn(['Oplopend','Aflopend']),
    query('stroken').isInt({ min: 1, max: 2 }),
  ],
  async (req, res, next) => {
    if (!controleerValidatie(req, res)) return;
    try {
      const CROWCalculator = require('../domain/calculators/CROWCalculator');
      const rekenregels    = await rekenregelRepo.haalOpOpScenario(Number(req.query.stroken));
      const resultaten     = CROWCalculator.bereken(
        Number(req.query.hmp),
        req.query.richting,
        rekenregels
      );
      res.json({ succes: true, plaatsingen: resultaten });
    } catch (err) { next(err); }
  }
);

// ── GET /api/calamiteiten/:id ─────────────────────────────────────────────────
/**
 * Geeft één volledig calamiteit-dossier terug (inclusief materieel, toeslagen, fotos).
 */
router.get(
  '/:id',
  [param('id').isInt({ min: 1 })],
  async (req, res, next) => {
    if (!controleerValidatie(req, res)) return;
    try {
      const gebruikerId = haalGebruikerIdOp(req);
      const calamiteit  = await calamiteitRepo.haalVolledigOpId(Number(req.params.id));

      if (!calamiteit) {
        return res.status(404).json({ succes: false, fout: 'Calamiteit niet gevonden.' });
      }

      // Medewerkers mogen alleen hun eigen calamiteiten inzien
      if (req.gebruiker.rol !== 'Admin' && calamiteit.maker_id !== gebruikerId) {
        return res.status(403).json({ succes: false, fout: 'Onvoldoende rechten voor dit dossier.' });
      }

      res.json({ succes: true, data: calamiteit });
    } catch (err) { next(err); }
  }
);

// ── POST /api/calamiteiten ────────────────────────────────────────────────────
/**
 * Wizard-submit: maakt een volledig calamiteit-dossier aan.
 * Voert transactie uit met snapshotting en CROW-berekening.
 */
router.post(
  '/',
  [
    body('klant_id').optional({ nullable: true }).isInt({ min: 1 }).withMessage('klant_id moet een geldig getal zijn.'),
    body('rijksweg').trim().notEmpty().withMessage('Rijksweg is verplicht.'),
    body('hmp').isFloat({ min: 0 }).withMessage('HMP moet een positief getal zijn.'),
    body('rijbaan_richting').isIn(['Oplopend','Aflopend']).withMessage('Richting moet Oplopend of Aflopend zijn.'),
    body('aantal_stroken').isInt({ min: 1, max: 2 }).withMessage('Aantal stroken moet 1 of 2 zijn.'),
    body('naam_inspecteur_rws').trim().notEmpty().withMessage('Naam van de inspecteur is verplicht.'),
    body('omschrijving').optional({ nullable: true }).isString(),
    body('materieel').optional().isArray(),
    body('collega_ids').optional().isArray(),
    body('vervolgactie').optional().isBoolean(),
    body('vervolgactie_omschrijving').optional({ nullable: true }).isString(),
    body('checklist_pbm').optional().isBoolean(),
    body('checklist_fotos_calamiteit').optional().isBoolean(),
    body('checklist_fotos_aanpak').optional().isBoolean(),
    body('checklist_veilig').optional().isBoolean(),
    body('checklist_stortbon').optional().isBoolean(),
  ],
  async (req, res, next) => {
    if (!controleerValidatie(req, res)) return;
    try {
      const gebruikerId = haalGebruikerIdOp(req);
      const resultaat   = await maakCalamiteitUC.uitvoer(req.body, gebruikerId);
      res.status(201).json({ succes: true, ...resultaat });
    } catch (err) { next(err); }
  }
);

// ── PATCH /api/calamiteiten/:id ───────────────────────────────────────────────
/**
 * Basis-correctie van velden door Admin (correctiemodus).
 */
router.patch(
  '/:id',
  vereistAdmin,
  [param('id').isInt({ min: 1 })],
  async (req, res, next) => {
    if (!controleerValidatie(req, res)) return;
    try {
      const gebruikerId = haalGebruikerIdOp(req);
      await wijzigCalamiteitUC.wijzigBasisVelden(Number(req.params.id), req.body, gebruikerId);
      res.json({ succes: true, bericht: 'Calamiteit bijgewerkt.' });
    } catch (err) { next(err); }
  }
);

// ── PUT /api/calamiteiten/:id/herbereken ──────────────────────────────────────
/**
 * Volledige herberekening (materieel + CROW + toeslagen) door Admin.
 */
router.put(
  '/:id/herbereken',
  vereistAdmin,
  [param('id').isInt({ min: 1 })],
  async (req, res, next) => {
    if (!controleerValidatie(req, res)) return;
    try {
      const gebruikerId = haalGebruikerIdOp(req);
      await wijzigCalamiteitUC.herbereken(Number(req.params.id), req.body, gebruikerId);
      res.json({ succes: true, bericht: 'Calamiteit volledig herberekend en bijgewerkt.' });
    } catch (err) { next(err); }
  }
);

// ── PATCH /api/calamiteiten/:id/status ───────────────────────────────────────
/**
 * Wijzigt de status van een calamiteit (Concept ↔ Ingezonden).
 * Medewerkers mogen alleen hun eigen calamiteiten indienen.
 */
router.patch(
  '/:id/status',
  [
    param('id').isInt({ min: 1 }),
    body('status').isIn(['Concept','Ingezonden']).withMessage('Status moet Concept of Ingezonden zijn.'),
  ],
  async (req, res, next) => {
    if (!controleerValidatie(req, res)) return;
    try {
      const gebruikerId = haalGebruikerIdOp(req);
      const calamiteit  = await calamiteitRepo.haalOpOpId(Number(req.params.id));
      if (!calamiteit) return res.status(404).json({ succes: false, fout: 'Calamiteit niet gevonden.' });

      if (req.gebruiker.rol !== 'Admin' && calamiteit.maker_id !== gebruikerId) {
        return res.status(403).json({ succes: false, fout: 'Onvoldoende rechten.' });
      }

      await calamiteitRepo.wijzig(Number(req.params.id), { status: req.body.status });
      await schrijfAuditLog({
        gebruikerId, actie: 'UPDATE', tabelNaam: 'calamiteit',
        recordId: req.params.id,
        oudeWaarde:  { status: calamiteit.status },
        nieuweWaarde: { status: req.body.status },
      });
      res.json({ succes: true, status: req.body.status });
    } catch (err) { next(err); }
  }
);

// ── POST /api/calamiteiten/:id/fotos ─────────────────────────────────────────
/**
 * Upload één of meerdere foto's voor een calamiteit.
 * Slaat bestandsreferenties op in de Foto-tabel.
 */
router.post(
  '/:id/fotos',
  [param('id').isInt({ min: 1 })],
  uploadFotos.array('fotos', 10),
  async (req, res, next) => {
    if (!controleerValidatie(req, res)) return;
    try {
      const calamiteitId = Number(req.params.id);
      const bestanden    = req.files;

      if (!bestanden || bestanden.length === 0) {
        return res.status(400).json({ succes: false, fout: 'Geen bestanden ontvangen.' });
      }

      const opgeslagen = [];
      for (const bestand of bestanden) {
        const relatievePad = path.relative(process.cwd(), bestand.path).replace(/\\/g, '/');
        const id = await fotoRepo.slaOp(calamiteitId, bestand.filename, relatievePad);
        opgeslagen.push({ id, bestandsnaam: bestand.filename, pad_url: relatievePad });
      }

      res.status(201).json({ succes: true, fotos: opgeslagen });
    } catch (err) { next(err); }
  }
);

module.exports = router;
