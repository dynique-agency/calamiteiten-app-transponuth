'use strict';

/**
 * =============================================================================
 * Centrale Fout-middleware — Fase 2
 * =============================================================================
 * Vangt ALLE fouten op die via next(err) worden doorgegeven in Express.
 * Zorgt voor consistente JSON-foutresponses en veilige foutafscherming.
 *
 * Principes:
 *  - Productie: stuur NOOIT een stack trace of interne details naar de client.
 *  - Development: voeg stack trace toe voor debuggen.
 *  - Elke foutrespons heeft altijd hetzelfde JSON-formaat.
 *  - MySQL- en validatiefouten worden vertaald naar begrijpelijke meldingen.
 *
 * Foutformaat:
 *  {
 *    "succes":     false,
 *    "fout":       "Leesbare foutmelding in het Nederlands",
 *    "code":       "OPTIONELE_FOUTCODE",   (development + bepaalde business-fouten)
 *    "velden":     [...],                  (alleen bij validatiefouten)
 *    "stack":      "...",                  (alleen in development)
 *  }
 * =============================================================================
 */

const logger = require('../infrastructure/logging/logger');

// ── MySQL foutcodes ────────────────────────────────────────────────────────────
const MYSQL_DUPLICATE_ENTRY    = 'ER_DUP_ENTRY';
const MYSQL_NO_REFERENCED_ROW  = 'ER_NO_REFERENCED_ROW_2';
const MYSQL_ROW_IS_REFERENCED  = 'ER_ROW_IS_REFERENCED_2';
const MYSQL_DATA_TOO_LONG      = 'ER_DATA_TOO_LONG';
const MYSQL_TRUNCATED_WRONG    = 'ER_TRUNCATED_WRONG_VALUE';
const MYSQL_BAD_NULL_ERROR     = 'ER_BAD_NULL_ERROR';

// ── Hulpfuncties ───────────────────────────────────────────────────────────────

/**
 * Vertaalt een MySQL-fout naar een gebruiksvriendelijke Nederlandse melding
 * en een passende HTTP-statuscode.
 *
 * @param {Error} err - MySQL-fout met een `code`-eigenschap
 * @returns {{ statusCode: number, bericht: string }}
 */
function vertaalMySQLFout(err) {
  switch (err.code) {
    case MYSQL_DUPLICATE_ENTRY:
      return { statusCode: 409, bericht: 'Dit record bestaat al. Controleer de ingevoerde gegevens op duplicaten.' };

    case MYSQL_NO_REFERENCED_ROW:
      return { statusCode: 400, bericht: 'Verwijzing naar een niet-bestaand record. Controleer de opgegeven ID-waarden.' };

    case MYSQL_ROW_IS_REFERENCED:
      return { statusCode: 409, bericht: 'Dit record kan niet worden verwijderd omdat er nog andere records naar verwijzen.' };

    case MYSQL_DATA_TOO_LONG:
      return { statusCode: 400, bericht: 'Een of meer velden bevatten te veel tekens. Controleer de maximale veldlengte.' };

    case MYSQL_TRUNCATED_WRONG:
      return { statusCode: 400, bericht: 'Een of meer waarden zijn ongeldig voor het opgegeven veldtype.' };

    case MYSQL_BAD_NULL_ERROR:
      return { statusCode: 400, bericht: 'Een verplicht veld ontbreekt. Controleer alle verplichte invoervelden.' };

    default:
      return { statusCode: 500, bericht: 'Er is een databasefout opgetreden.' };
  }
}

/**
 * Controleert of een fout afkomstig is van mysql2 aan de hand van bekende kenmerken.
 *
 * @param {Error} err
 * @returns {boolean}
 */
function isMySQLFout(err) {
  return typeof err.code === 'string' && err.code.startsWith('ER_');
}

/**
 * Controleert of een fout afkomstig is van express-validator.
 * express-validator voegt een `type` property toe met waarde 'field'.
 *
 * @param {Error} err
 * @returns {boolean}
 */
function isValidatieFout(err) {
  return err.type === 'field' || (Array.isArray(err.errors) && err.errors.length > 0);
}

// ── Centrale fout-middleware ───────────────────────────────────────────────────

/**
 * Express fout-middleware (vier parameters, altijd als laatste geregistreerd).
 * Verwerkt alle fouten uit de applicatie tot een veilige, consistente JSON-response.
 *
 * Richtlijnen voor het gooien van fouten vanuit de applicatie:
 *   const fout = new Error('Omschrijving');
 *   fout.statusCode = 404;  // HTTP-statuscode
 *   fout.code = 'NIET_GEVONDEN'; // Optionele machineleesbare code
 *   throw fout; (of: next(fout))
 */
// eslint-disable-next-line no-unused-vars
function foutAfhandeling(err, req, res, next) {
  const isProduction = process.env.NODE_ENV === 'production';

  // ── Stap 1: Bepaal statuscode en bericht op basis van het fouttype ───────────

  let statusCode;
  let bericht;
  let extra = {};

  if (isMySQLFout(err)) {
    // MySQL-databasefouten
    const vertaald = vertaalMySQLFout(err);
    statusCode = vertaald.statusCode;
    bericht    = vertaald.bericht;
    if (!isProduction) {
      extra.dbCode = err.code;
    }

  } else if (isValidatieFout(err)) {
    // express-validator invoerfouten (doorgegeven via next(err) of als Error-object)
    statusCode  = 400;
    bericht     = 'Invoervalidatie mislukt. Controleer de opgegeven velden.';
    extra.velden = err.errors ?? [];

  } else if (err.name === 'SyntaxError' && err.type === 'entity.parse.failed') {
    // Ongeldige JSON in de request body
    statusCode = 400;
    bericht    = 'Ongeldige JSON in de aanvraag. Controleer de request body.';

  } else if (err.name === 'MulterError') {
    // Multer bestandsupload-fouten
    statusCode = 400;
    bericht    = err.code === 'LIMIT_FILE_SIZE'
      ? `Bestand te groot. Maximale bestandsgrootte is ${process.env.MAX_BESTAND_GROOTTE_MB || 10} MB.`
      : `Fout bij uploaden van bestand: ${err.message}`;

  } else {
    // Applicatiefouten en overige fouten
    statusCode = err.statusCode || err.status || 500;
    bericht    = err.message || 'Er is een onverwachte serverfout opgetreden.';

    // Maskeer interne serverfouten in productie (500-reeks)
    if (isProduction && statusCode >= 500) {
      bericht = 'Er is een interne serverfout opgetreden. Probeer het later opnieuw of neem contact op met de beheerder.';
    }
  }

  // ── Stap 2: Logging ──────────────────────────────────────────────────────────

  const logContext = {
    methode:   req.method,
    pad:       req.originalUrl,
    ip:        req.ip,
    gebruiker: req.gebruiker?.naam ?? 'anoniem',
    body:      isProduction ? '[verborgen]' : req.body,
  };

  if (statusCode >= 500) {
    logger.error(`[${statusCode}] ${req.method} ${req.originalUrl} — ${err.message}`, {
      ...logContext,
      stack: err.stack,
    });
  } else if (statusCode >= 400) {
    logger.warn(`[${statusCode}] ${req.method} ${req.originalUrl} — ${bericht}`, logContext);
  }

  // ── Stap 3: Antwoord sturen ──────────────────────────────────────────────────

  // Zorg dat we niet proberen te antwoorden als de headers al zijn verstuurd
  if (res.headersSent) {
    return next(err);
  }

  res.status(statusCode).json({
    succes: false,
    fout:   bericht,
    ...extra,
    // Alleen in development-modus: stack trace voor debuggen
    ...(
      !isProduction && {
        debug: {
          type:  err.name || err.constructor?.name,
          stack: err.stack,
        },
      }
    ),
  });
}

// ── Afhandeling van onbeloofde promise-afwijzingen (veiligheidsnet) ───────────

/**
 * Vangt onverwerkte promise-afwijzingen op die niet via next(err) zijn doorgegeven.
 * Logt de fout zodat deze niet geruisloos verdwijnt.
 *
 * Registreer als: process.on('unhandledRejection', onOnbehandeldeAfwijzing)
 *
 * @param {Error|*} reden
 * @param {Promise} belofte
 */
function onOnbehandeldeAfwijzing(reden, belofte) {
  logger.error('Onbehandelde Promise-afwijzing:', {
    reden: reden instanceof Error ? reden.message : String(reden),
    stack: reden instanceof Error ? reden.stack   : undefined,
    belofte: String(belofte),
  });
  // In productie: gecontroleerd afsluiten na logging
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

/**
 * Vangt onverwachte synchrone uitzonderingen op die het proces zouden crashen.
 * Registreer als: process.on('uncaughtException', onOnverwachteUitzondering)
 *
 * @param {Error} err
 */
function onOnverwachteUitzondering(err) {
  logger.error('Onverwachte uitzondering — applicatie wordt gestopt:', {
    bericht: err.message,
    stack:   err.stack,
  });
  // Verplicht afsluiten na een uncaughtException (Node.js-aanbeveling)
  process.exit(1);
}

module.exports = {
  foutAfhandeling,
  onOnbehandeldeAfwijzing,
  onOnverwachteUitzondering,
};
