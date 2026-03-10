'use strict';

const { genereerKostenoverzicht } = require('../../infrastructure/generatoren/excelGenerator');

/**
 * Use-case: GenereerExcel (Kostenoverzicht per week)
 * Haalt calamiteiten op voor de gevraagde week en genereert een Excel-buffer.
 */
class GenereerExcel {
  constructor({ calamiteitRepo }) {
    this.calamiteitRepo = calamiteitRepo;
  }

  /**
   * @param {object} filters
   * @param {number} filters.jaar         - Bijv. 2026
   * @param {number} filters.week         - Weeknummer 1–53
   * @param {Date}   filters.startDatum   - Maandag van de gewenste week (UTC)
   * @param {Date}   filters.eindDatum    - Zondag 23:59:59 van de gewenste week (UTC)
   * @param {number} [filters.klantId]    - Optioneel klantfilter
   * @returns {Promise<{buffer: Buffer, bestandsnaam: string}>}
   */
  async uitvoer(filters = {}) {
    const { jaar, week, startDatum, eindDatum, klantId } = filters;

    // Haal basislijst op gefilterd op de weekperiode
    const basisLijst = await this.calamiteitRepo.haalAlleOp({
      startDatum,
      eindDatum,
      klantId,
      limit:  1000,
      offset: 0,
    });

    // Haal voor elke calamiteit de volledige details op (materieel, collegalijst, toeslagen)
    const volledigeLijst = await Promise.all(
      basisLijst.map((c) => this.calamiteitRepo.haalVolledigOpId(c.id))
    );

    // Filter null-resultaten (defensief)
    const geldigeLijst = volledigeLijst.filter(Boolean);

    const buffer = await genereerKostenoverzicht(geldigeLijst, {
      jaar,
      week,
      startDatum,
      eindDatum,
      klantNaam: klantId
        ? (geldigeLijst.find((c) => c.klant_naam)?.klant_naam ?? 'Gefilterd')
        : 'Alle',
    });

    // Bestandsnaam: kostenoverzicht_2026_w03.xlsx
    const weekPad     = String(week).padStart(2, '0');
    const bestandsnaam = `kostenoverzicht_${jaar}_w${weekPad}.xlsx`;

    return { buffer, bestandsnaam };
  }
}

module.exports = GenereerExcel;
