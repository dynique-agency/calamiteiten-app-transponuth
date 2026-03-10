'use strict';

/**
 * =============================================================================
 * CROW Rekenmodule — Fase 2
 * =============================================================================
 * Pure domeinlogica conform de CROW-richtlijnen voor tijdelijke verkeersmaatregelen.
 * Geen enkele framework- of databaseafhankelijkheid.
 *
 * Kernregel (uit business rules sectie 4):
 *   Richting 'Oplopend' → HMP-positie = startHmp MINUS offset
 *   Richting 'Aflopend' → HMP-positie = startHmp PLUS  offset
 *
 * Uitvoer altijd op 3 decimalen (bijv. 255.100), conform HMP-notatie op de weg.
 * =============================================================================
 */

/** @typedef {'Oplopend'|'Aflopend'} Rijrichting */

/**
 * @typedef {object} Rekenregel
 * @property {string} object_naam  - Naam van het CROW-object (bijv. 'Waarschuwing 1')
 * @property {number|string} offset_hmp - Offset in km t.o.v. startpositie (altijd >= 0)
 * @property {number} [volgorde]   - Weergavevolgorde (standaard 0)
 */

/**
 * @typedef {object} PlaatsingsResultaat
 * @property {string} object_naam  - Naam van het CROW-object
 * @property {string} hmp_positie  - Berekende HMP-positie als string met 3 decimalen
 * @property {number} hmp_getal    - Numerieke waarde voor verdere berekeningen
 * @property {number} volgorde     - Weergavevolgorde
 * @property {boolean} is_handmatig - Altijd false bij automatische berekening
 */

class CROWCalculator {
  // Geldige rijrichtingen conform de business rules
  static GELDIGE_RICHTINGEN = Object.freeze(['Oplopend', 'Aflopend']);

  // Aantal decimalen in de HMP-notatie (CROW-standaard)
  static HMP_DECIMALEN = 3;

  /**
   * Valideert en parseert een HMP-waarde naar een betrouwbaar getal.
   * Gooit een AppFout als de waarde niet geldig is.
   *
   * @param {*} hmp
   * @param {string} [veldnaam='startHmp']
   * @returns {number}
   */
  static _parseHmp(hmp, veldnaam = 'startHmp') {
    const waarde = Number(hmp);
    if (!Number.isFinite(waarde)) {
      const fout = new Error(`CROW: Ongeldige HMP-waarde voor '${veldnaam}': ${hmp}`);
      fout.statusCode = 400;
      throw fout;
    }
    if (waarde < 0) {
      const fout = new Error(`CROW: HMP-waarde '${veldnaam}' mag niet negatief zijn (ontvangen: ${waarde}).`);
      fout.statusCode = 400;
      throw fout;
    }
    return waarde;
  }

  /**
   * Formateert een numerieke HMP-waarde naar de CROW-standaardnotatie (3 decimalen).
   *
   * @param {number} hmp
   * @returns {string} bijv. '255.100'
   */
  static formatteerHmp(hmp) {
    return Number(hmp).toFixed(CROWCalculator.HMP_DECIMALEN);
  }

  /**
   * Berekent de HMP-plaatsingsposities van alle CROW-objecten voor één calamiteit.
   *
   * De offset uit de DB geeft altijd de afstand in km t.o.v. het incident aan.
   * De rijrichting bepaalt of de borden vóór of achter de HMP worden geplaatst:
   *   - Oplopend: HM-nummers lopen op → waarschuwingsborden liggen EERDER (lagere km) → aftrekken
   *   - Aflopend: HM-nummers lopen af → waarschuwingsborden liggen EERDER (hogere km) → optellen
   *
   * @param {number|string} startHmp      - HMP startpositie van de calamiteit
   * @param {Rijrichting} richting         - 'Oplopend' of 'Aflopend'
   * @param {Rekenregel[]} rekenregels     - Regelset uit de database (gesorteerd op volgorde)
   * @returns {PlaatsingsResultaat[]}
   */
  static bereken(startHmp, richting, rekenregels) {
    // --- Invoervalidatie ---
    const hmpGetal = CROWCalculator._parseHmp(startHmp);

    if (!CROWCalculator.GELDIGE_RICHTINGEN.includes(richting)) {
      const fout = new Error(
        `CROW: Ongeldige rijrichting '${richting}'. Toegestaan: ${CROWCalculator.GELDIGE_RICHTINGEN.join(', ')}.`
      );
      fout.statusCode = 400;
      throw fout;
    }

    if (!Array.isArray(rekenregels) || rekenregels.length === 0) {
      const fout = new Error('CROW: Geen rekenregels opgegeven. Controleer of de CROW-stamdata is geladen.');
      fout.statusCode = 422;
      throw fout;
    }

    // --- Berekening ---
    return rekenregels.map((regel, index) => {
      if (!regel.object_naam || typeof regel.object_naam !== 'string') {
        const fout = new Error(`CROW: Rekenregel #${index + 1} heeft geen geldige object_naam.`);
        fout.statusCode = 422;
        throw fout;
      }

      const offset = CROWCalculator._parseHmp(regel.offset_hmp, `offset van '${regel.object_naam}'`);

      // Kernberekening conform business rules sectie 4
      const positieGetal = richting === 'Oplopend'
        ? hmpGetal - offset   // Borden liggen VOOR het incident (lagere km)
        : hmpGetal + offset;  // Borden liggen VOOR het incident (hogere km)

      return {
        object_naam:  regel.object_naam,
        hmp_positie:  CROWCalculator.formatteerHmp(positieGetal),
        hmp_getal:    positieGetal,
        volgorde:     Number(regel.volgorde ?? index),
        is_handmatig: false,
      };
    });
  }

  /**
   * Past één of meerdere handmatige overrides toe op een eerder berekend resultaat.
   * Gebruikt door de wizard wanneer de medewerker een positie handmatig aanpast
   * (bijv. door sprongen in het wegennet).
   *
   * @param {PlaatsingsResultaat[]} berekendeResultaten  - Uitvoer van bereken()
   * @param {Record<string, number|string>} overrides    - { object_naam: nieuwe_hmp_waarde }
   * @returns {PlaatsingsResultaat[]} - Nieuw array; origineel wordt niet gemuteerd
   */
  static pasOverridesToe(berekendeResultaten, overrides = {}) {
    if (typeof overrides !== 'object' || overrides === null) {
      const fout = new Error('CROW: Overrides moeten als object worden meegegeven.');
      fout.statusCode = 400;
      throw fout;
    }

    return berekendeResultaten.map((resultaat) => {
      if (Object.prototype.hasOwnProperty.call(overrides, resultaat.object_naam)) {
        const overschrevenHmp = CROWCalculator._parseHmp(
          overrides[resultaat.object_naam],
          `override voor '${resultaat.object_naam}'`
        );
        return {
          ...resultaat,
          hmp_positie:  CROWCalculator.formatteerHmp(overschrevenHmp),
          hmp_getal:    overschrevenHmp,
          is_handmatig: true,
        };
      }
      return { ...resultaat };
    });
  }

  /**
   * Converteert een berekeningsresultaat naar het DB-formaat voor Calamiteit_Plaatsing.
   *
   * @param {PlaatsingsResultaat[]} resultaten
   * @param {number} calamiteitId
   * @returns {object[]}
   */
  static naarDbPlaatsingen(resultaten, calamiteitId) {
    return resultaten.map((r) => ({
      calamiteit_id: calamiteitId,
      object_naam:   r.object_naam,
      hmp_positie:   r.hmp_getal,
      is_handmatig:  r.is_handmatig ? 1 : 0,
      volgorde:      r.volgorde,
    }));
  }
}

module.exports = CROWCalculator;
