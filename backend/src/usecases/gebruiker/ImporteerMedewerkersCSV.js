'use strict';

const bcrypt = require('bcryptjs');

/**
 * =============================================================================
 * Use-case: ImporteerMedewerkersCSV — Fase 3
 * =============================================================================
 * Verwerkt een CSV-bestand met medewerkergegevens en importeert deze in de DB.
 *
 * CSV-formaat (eerste rij = header, verplicht):
 *   external_id,naam,wachtwoord,rol
 *
 * Velden:
 *   external_id : YourSoft personeels-ID (VERPLICHT, uniek)
 *   naam        : Volledige naam (VERPLICHT)
 *   wachtwoord  : Initieel wachtwoord (optioneel; leeg = bestaand behouden)
 *   rol         : 'Admin' of 'Medewerker' (standaard: 'Medewerker')
 *
 * UPSERT-logica op basis van external_id (conform YourSoft-koppeling):
 *   - external_id bestaat → UPDATE naam, rol en optioneel wachtwoord
 *   - external_id bestaat niet → INSERT nieuwe gebruiker
 *
 * Resultaat:
 *   { aangemaakt: N, bijgewerkt: N, overgeslagen: N, fouten: [{rij, fout}] }
 * =============================================================================
 */
class ImporteerMedewerkersCSV {
  static BCRYPT_ROUNDS = 12;
  static GELDIGE_ROLLEN = ['Admin', 'Medewerker'];

  /**
   * @param {object} deps
   * @param {object} deps.gebruikerRepo
   * @param {object} deps.auditLogger
   */
  constructor({ gebruikerRepo, auditLogger }) {
    this.gebruikerRepo = gebruikerRepo;
    this.auditLogger   = auditLogger;
  }

  /**
   * Verwerkt de volledige CSV-inhoud als string.
   *
   * @param {string} csvInhoud   - Raw CSV-tekst (UTF-8)
   * @param {number} gebruikerId - Admin die de import uitvoert
   * @returns {Promise<{aangemaakt: number, bijgewerkt: number, overgeslagen: number, fouten: object[]}>}
   */
  async uitvoer(csvInhoud, gebruikerId) {
    if (!csvInhoud || typeof csvInhoud !== 'string') {
      throw Object.assign(new Error('CSV-inhoud is leeg of ongeldig.'), { statusCode: 400 });
    }

    const rijen = ImporteerMedewerkersCSV._parseCSV(csvInhoud);

    if (rijen.length === 0) {
      throw Object.assign(new Error('CSV bevat geen gegevensrijen na de header.'), { statusCode: 400 });
    }

    const resultaat = { aangemaakt: 0, bijgewerkt: 0, overgeslagen: 0, fouten: [] };

    for (let i = 0; i < rijen.length; i++) {
      const rijNummer = i + 2; // +2 voor header-rij en 0-index
      const rij = rijen[i];

      try {
        await this._verwerkRij(rij, rijNummer, gebruikerId, resultaat);
      } catch (err) {
        resultaat.fouten.push({ rij: rijNummer, fout: err.message });
        resultaat.overgeslagen++;
      }
    }

    return resultaat;
  }

  /**
   * Verwerkt één CSV-rij.
   *
   * @param {object} rij
   * @param {number} rijNummer
   * @param {number} gebruikerId
   * @param {object} resultaat - Bijgewerkt in-place
   */
  async _verwerkRij(rij, rijNummer, gebruikerId, resultaat) {
    // ── Validatie ──────────────────────────────────────────────────────────────
    if (!rij.external_id || !rij.external_id.trim()) {
      throw new Error(`Rij ${rijNummer}: 'external_id' is verplicht maar ontbreekt.`);
    }
    if (!rij.naam || !rij.naam.trim()) {
      throw new Error(`Rij ${rijNummer}: 'naam' is verplicht maar ontbreekt.`);
    }

    const externalId = rij.external_id.trim();
    const naam       = rij.naam.trim();
    const rol        = ImporteerMedewerkersCSV.GELDIGE_ROLLEN.includes(rij.rol?.trim())
      ? rij.rol.trim()
      : 'Medewerker';

    // ── Wachtwoord hashen (alleen als opgegeven) ───────────────────────────────
    let wachtwoordHash = null;
    if (rij.wachtwoord && rij.wachtwoord.trim().length >= 6) {
      wachtwoordHash = await bcrypt.hash(rij.wachtwoord.trim(), ImporteerMedewerkersCSV.BCRYPT_ROUNDS);
    } else if (rij.wachtwoord && rij.wachtwoord.trim().length > 0) {
      throw new Error(`Rij ${rijNummer}: wachtwoord te kort (minimaal 6 tekens).`);
    }

    // ── UPSERT via repository ──────────────────────────────────────────────────
    const uitvoerResultaat = await this.gebruikerRepo.upsertOpExternalId({
      external_id:    externalId,
      naam,
      rol,
      actief:         1,
      wachtwoord_hash: wachtwoordHash,
    });

    // ── Audit-log ──────────────────────────────────────────────────────────────
    await this.auditLogger.schrijfAuditLog({
      gebruikerId,
      actie:       uitvoerResultaat.actie === 'aangemaakt' ? 'INSERT' : 'UPDATE',
      tabelNaam:   'gebruiker',
      recordId:    uitvoerResultaat.id,
      oudeWaarde:  null,
      nieuweWaarde: { external_id: externalId, naam, rol },
    });

    if (uitvoerResultaat.actie === 'aangemaakt') {
      resultaat.aangemaakt++;
    } else {
      resultaat.bijgewerkt++;
    }
  }

  /**
   * Parseert CSV-tekst naar een array van objecten.
   * Ondersteunt:
   *   - Komma-gescheiden velden
   *   - Geciteerde velden met komma's erin ("De Vries, Jan")
   *   - Windows (\r\n) en Unix (\n) regeleindes
   *   - Lege regels (worden overgeslagen)
   *
   * @param {string} tekst
   * @returns {object[]}
   */
  static _parseCSV(tekst) {
    const regels = tekst.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    if (regels.length < 2) return [];

    // Header-rij verwerken (case-insensitief, whitespace trimmend)
    const headers = ImporteerMedewerkersCSV._splitCSVRegel(regels[0])
      .map((h) => h.toLowerCase().trim());

    const vereisteHeaders = ['external_id', 'naam'];
    for (const vereist of vereisteHeaders) {
      if (!headers.includes(vereist)) {
        throw Object.assign(
          new Error(`CSV-header mist verplichte kolom: '${vereist}'. Verwachte headers: external_id,naam,wachtwoord,rol`),
          { statusCode: 400 }
        );
      }
    }

    const rijen = [];
    for (let i = 1; i < regels.length; i++) {
      const regel = regels[i].trim();
      if (!regel) continue; // Lege regels overslaan

      const waarden = ImporteerMedewerkersCSV._splitCSVRegel(regel);
      const obj = {};
      headers.forEach((header, idx) => {
        obj[header] = (waarden[idx] ?? '').trim();
      });
      rijen.push(obj);
    }

    return rijen;
  }

  /**
   * Splitst één CSV-regel op komma's met ondersteuning voor geciteerde velden.
   *
   * @param {string} regel
   * @returns {string[]}
   */
  static _splitCSVRegel(regel) {
    const velden = [];
    let huidig   = '';
    let inCitaat = false;

    for (let i = 0; i < regel.length; i++) {
      const teken = regel[i];

      if (teken === '"') {
        if (inCitaat && regel[i + 1] === '"') {
          // Escaped aanhalingsteken binnen citaat
          huidig += '"';
          i++;
        } else {
          inCitaat = !inCitaat;
        }
      } else if (teken === ',' && !inCitaat) {
        velden.push(huidig);
        huidig = '';
      } else {
        huidig += teken;
      }
    }

    velden.push(huidig);
    return velden;
  }
}

module.exports = ImporteerMedewerkersCSV;
