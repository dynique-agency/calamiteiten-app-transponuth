'use strict';

/**
 * =============================================================================
 * Auth Middleware — Fase 2
 * =============================================================================
 * JWT-verificatie en Role-Based Access Control (RBAC) voor de Express API.
 *
 * Rollen (conform business rules sectie 1):
 *   Admin      → volledige toegang: stamdata beheer, correctiemodus, exports
 *   Medewerker → beperkte toegang: eigen calamiteiten aanmaken en inzien
 *
 * Gebruik in routes:
 *   router.use(verifieerToken)                      // Vereist voor alle beschermde routes
 *   router.post('/...', vereistAdmin, handler)      // Alleen Admin
 *   router.get('/...',  vereistMedewerker, handler) // Medewerker of hoger
 *   router.patch('/...', vereistRol(['Admin']), handler) // Flexibele RBAC
 *
 * Token-payload structuur (na jwt.sign):
 *   { id: number, naam: string, rol: 'Admin'|'Medewerker', iat: number, exp: number }
 * =============================================================================
 */

const jwt    = require('jsonwebtoken');
const logger = require('../infrastructure/logging/logger');

// Alle geldige rollen in het systeem (enkelvoudige bron van waarheid)
const GELDIGE_ROLLEN = Object.freeze(['Admin', 'Medewerker']);

// ── Kernmiddleware ─────────────────────────────────────────────────────────────

/**
 * Extraheert en verifieert het JWT Bearer-token uit de Authorization-header.
 * Voegt bij succes `req.gebruiker` toe met de token-payload.
 *
 * Foutcodes:
 *   401 → Geen token aanwezig
 *   401 → Token is verlopen (TokenExpiredError)
 *   403 → Token heeft een ongeldige handtekening of structuur
 */
function verifieerToken(req, res, next) {
  const authHeader = req.headers['authorization'];

  // Verwacht formaat: 'Bearer <token>'
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      succes: false,
      fout:   'Toegang geweigerd: geen autorisatietoken aanwezig.',
    });
  }

  const token = authHeader.slice(7); // Verwijder 'Bearer ' prefix

  if (!token) {
    return res.status(401).json({
      succes: false,
      fout:   'Toegang geweigerd: leeg token ontvangen.',
    });
  }

  if (!process.env.JWT_SECRET) {
    // Configuratiefout — nooit in productie bereikbaar als .env correct is
    logger.error('KRITIEK: JWT_SECRET is niet geconfigureerd in de omgevingsvariabelen!');
    return res.status(500).json({
      succes: false,
      fout:   'Serverconfiguratiefout. Neem contact op met de beheerder.',
    });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Valideer de payload-structuur (bescherming tegen gemanipuleerde tokens)
    if (!payload.id || !payload.rol || !GELDIGE_ROLLEN.includes(payload.rol)) {
      logger.warn(`Ongeldig token-payload ontvangen van IP ${req.ip}: rol='${payload.rol}'`);
      return res.status(403).json({
        succes: false,
        fout:   'Ongeldig token: ontbrekende of ongeldige rolclaim.',
      });
    }

    // Beschikbaar stellen voor alle volgende middleware en handlers
    req.gebruiker = {
      id:   payload.id,
      naam: payload.naam,
      rol:  payload.rol,
    };

    next();
  } catch (err) {
    // Onderscheid tussen verlopen en ongeldig token voor betere foutmeldingen
    if (err instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        succes:    false,
        fout:      'Sessie verlopen. Meld u opnieuw aan.',
        verlopen:  true,
      });
    }

    if (err instanceof jwt.JsonWebTokenError) {
      logger.warn(`Ongeldig JWT ontvangen van IP ${req.ip}: ${err.message}`);
      return res.status(403).json({
        succes: false,
        fout:   'Ongeldig token. Meld u opnieuw aan.',
      });
    }

    // Onverwachte JWT-bibliotheekfout
    logger.error('Onverwachte fout bij JWT-verificatie:', err);
    return res.status(500).json({
      succes: false,
      fout:   'Interne serverfout bij authenticatie.',
    });
  }
}

// ── RBAC Helpers ──────────────────────────────────────────────────────────────

/**
 * Middleware-fabriek: staat alleen aanvragen door met een van de opgegeven rollen.
 * Gebruik altijd NA `verifieerToken`.
 *
 * @param {string[]} toegestaneRollen - Bijv. ['Admin'] of ['Admin', 'Medewerker']
 * @returns {Function} Express middleware
 *
 * @example
 * router.delete('/:id', verifieerToken, vereistRol(['Admin']), handler);
 */
function vereistRol(toegestaneRollen) {
  if (!Array.isArray(toegestaneRollen) || toegestaneRollen.length === 0) {
    throw new Error('vereistRol: geef minimaal één rol op als array.');
  }

  const ongeldigeRollen = toegestaneRollen.filter((r) => !GELDIGE_ROLLEN.includes(r));
  if (ongeldigeRollen.length > 0) {
    throw new Error(`vereistRol: ongeldige rollen opgegeven: ${ongeldigeRollen.join(', ')}`);
  }

  return function rolControle(req, res, next) {
    if (!req.gebruiker) {
      // Dit mag nooit voorkomen als verifieerToken correct is gebruik
      return res.status(401).json({
        succes: false,
        fout:   'Niet geauthenticeerd. Gebruik verifieerToken vóór vereistRol.',
      });
    }

    if (!toegestaneRollen.includes(req.gebruiker.rol)) {
      logger.warn(
        `Onvoldoende rechten: gebruiker '${req.gebruiker.naam}' (rol: ${req.gebruiker.rol}) ` +
        `probeerde ${req.method} ${req.originalUrl} aan te roepen ` +
        `(vereist: ${toegestaneRollen.join(' of ')})`
      );
      return res.status(403).json({
        succes:          false,
        fout:            `Onvoldoende rechten. Vereiste rol: ${toegestaneRollen.join(' of ')}.`,
        benodigdeRol:    toegestaneRollen,
        huidigeRol:      req.gebruiker.rol,
      });
    }

    next();
  };
}

/**
 * Vereist de rol 'Admin'.
 * Snelkoppeling voor `vereistRol(['Admin'])`.
 * Gebruik altijd NA `verifieerToken`.
 */
const vereistAdmin = vereistRol(['Admin']);

/**
 * Staat toegang toe voor zowel 'Admin' als 'Medewerker'.
 * Feitelijk: elke ingelogde gebruiker met een geldige rol.
 * Gebruik als extra expliciete check na `verifieerToken`.
 */
const vereistMedewerker = vereistRol(['Admin', 'Medewerker']);

// ── Hulpfuncties voor gebruik in controllers ──────────────────────────────────

/**
 * Controleert of de ingelogde gebruiker de opgegeven rol heeft.
 * Gebruik in controllers voor conditionele logica (geen middleware).
 *
 * @param {object} req - Express request object
 * @param {string} rol - 'Admin' of 'Medewerker'
 * @returns {boolean}
 *
 * @example
 * if (heeftRol(req, 'Admin')) { ... }
 */
function heeftRol(req, rol) {
  return req.gebruiker?.rol === rol;
}

/**
 * Geeft het ID van de ingelogde gebruiker terug.
 * Gooit als req.gebruiker niet aanwezig is (ontbrekende verifieerToken in de keten).
 *
 * @param {object} req
 * @returns {number}
 */
function haalGebruikerIdOp(req) {
  if (!req.gebruiker?.id) {
    const fout = new Error('Kon gebruiker-ID niet ophalen: geen geauthenticeerde gebruiker.');
    fout.statusCode = 401;
    throw fout;
  }
  return req.gebruiker.id;
}

module.exports = {
  verifieerToken,
  vereistRol,
  vereistAdmin,
  vereistMedewerker,
  heeftRol,
  haalGebruikerIdOp,
  GELDIGE_ROLLEN,
};
