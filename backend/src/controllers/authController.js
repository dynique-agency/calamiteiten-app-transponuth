'use strict';

const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

const gebruikerRepo                  = require('../infrastructure/db/gebruikerRepository');
const { verifieerToken, heeftRol }   = require('../middleware/authMiddleware');
const logger                         = require('../infrastructure/logging/logger');

const router = express.Router();

// ── POST /api/auth/inloggen ────────────────────────────────────────────────────
/**
 * Verifieert naam + wachtwoord en geeft een gesigneerd JWT terug.
 * Het token bevat: { id, naam, rol, iat, exp }.
 */
router.post(
  '/inloggen',
  [
    body('naam')
      .trim()
      .notEmpty().withMessage('Naam is verplicht.')
      .isLength({ max: 150 }).withMessage('Naam mag maximaal 150 tekens bevatten.'),
    body('wachtwoord')
      .notEmpty().withMessage('Wachtwoord is verplicht.')
      .isLength({ min: 6 }).withMessage('Wachtwoord moet minimaal 6 tekens bevatten.'),
  ],
  async (req, res, next) => {
    // Validatiefouten teruggeven vóór de DB-query
    const fouten = validationResult(req);
    if (!fouten.isEmpty()) {
      return res.status(400).json({ succes: false, fouten: fouten.array() });
    }

    try {
      const { naam, wachtwoord } = req.body;

      // Haal gebruiker op uit de database (inclusief wachtwoord_hash)
      const gebruiker = await gebruikerRepo.haalOpOpNaam(naam);

      // Gebruik een vaste foutmelding voor zowel 'gebruiker niet gevonden' als 'verkeerd wachtwoord'
      // zodat aanvallers niet kunnen achterhalen welk deel fout is (timing-safe via bcrypt)
      const ongeldig = !gebruiker || !(await bcrypt.compare(wachtwoord, gebruiker.wachtwoord_hash));
      if (ongeldig) {
        logger.warn(`Mislukte inlogpoging voor naam: '${naam}' van IP ${req.ip}`);
        return res.status(401).json({ succes: false, fout: 'Ongeldige naam of wachtwoord.' });
      }

      // Actief-check: gedeactiveerde medewerkers mogen niet inloggen
      if (!gebruiker.actief) {
        return res.status(403).json({ succes: false, fout: 'Dit account is gedeactiveerd. Neem contact op met de beheerder.' });
      }

      // Genereer het JWT-token
      const token = jwt.sign(
        { id: gebruiker.id, naam: gebruiker.naam, rol: gebruiker.rol },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_VERLOOPTIJD || '8h' }
      );

      logger.info(`Gebruiker '${gebruiker.naam}' (${gebruiker.rol}) is ingelogd van IP ${req.ip}`);

      res.json({
        succes:    true,
        token,
        gebruiker: {
          id:   gebruiker.id,
          naam: gebruiker.naam,
          rol:  gebruiker.rol,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/auth/huidige ──────────────────────────────────────────────────────
/**
 * Geeft de gegevens van de huidig ingelogde gebruiker terug.
 * Handig voor de frontend om na het verversen van de pagina de sessie te herstellen.
 */
router.get('/huidige', verifieerToken, async (req, res, next) => {
  try {
    const gebruiker = await gebruikerRepo.haalOpOpId(req.gebruiker.id);
    if (!gebruiker) {
      return res.status(404).json({ succes: false, fout: 'Gebruiker niet gevonden.' });
    }
    res.json({
      succes: true,
      gebruiker: {
        id:   gebruiker.id,
        naam: gebruiker.naam,
        rol:  gebruiker.rol,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
