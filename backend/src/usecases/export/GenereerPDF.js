'use strict';

const { genereerCalamiteitPDF } = require('../../infrastructure/generatoren/pdfGenerator');

/**
 * Use-case: GenereerPDF
 * Haalt de volledige calamiteit-data op en genereert een PDF-buffer.
 */
class GenereerPDF {
  constructor({ calamiteitRepo }) {
    this.calamiteitRepo = calamiteitRepo;
  }

  /**
   * @param {number} calamiteitId
   * @param {object} [opties]
   * @returns {Promise<{buffer: Buffer, bestandsnaam: string}>}
   */
  async uitvoer(calamiteitId, opties = {}) {
    const calamiteit = await this.calamiteitRepo.haalVolledigOpId(calamiteitId);
    if (!calamiteit) {
      throw Object.assign(
        new Error(`Calamiteit ${calamiteitId} niet gevonden.`),
        { statusCode: 404 }
      );
    }

    const buffer = await genereerCalamiteitPDF(calamiteit, opties);
    const datum  = new Date().toISOString().slice(0, 10);
    const bestandsnaam = `calamiteit_${String(calamiteitId).padStart(4,'0')}_${calamiteit.rijksweg.replace(/\s/g,'')}_${datum}.pdf`;

    return { buffer, bestandsnaam };
  }
}

module.exports = GenereerPDF;
