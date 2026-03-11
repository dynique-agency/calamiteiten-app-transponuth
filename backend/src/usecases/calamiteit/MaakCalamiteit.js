'use strict';

const { withTransactie }  = require('../../infrastructure/db/verbinding');
const Calamiteit          = require('../../domain/entities/Calamiteit');
const CROWCalculator      = require('../../domain/calculators/CROWCalculator');
const StruktuurCalculator = require('../../domain/calculators/StruktuurCalculator');

/**
 * =============================================================================
 * Use-case: MaakCalamiteit — Fase 3
 * =============================================================================
 * Orkestreert het volledig aanmaken van een calamiteit-dossier:
 *
 *  1. Domeinvalidatie (Calamiteit-entiteit)
 *  2. CROW-berekening + handmatige overrides
 *  3. Ophalen materieel-tarieven voor snapshotting
 *  4. Ophalen weekendtarieven uit Configuratie
 *  5. Strukton-berekening (factor + weekendtoeslagen)
 *  6. SQL-TRANSACTIE:
 *       a. INSERT Calamiteit
 *       b. INSERT Calamiteit_Materieel  (met prijs-snapshot)
 *       c. INSERT Calamiteit_Toeslag    (met tarief-snapshot)
 *       d. INSERT Calamiteit_Collega
 *       e. INSERT Calamiteit_Plaatsing  (CROW-posities + overrides)
 *  7. Retour: volledig nieuw ID
 *
 * Snapshotting-garantie (business rules sectie 3):
 *   De tarieven worden op het moment van opslaan bevroren in de junction-tabellen.
 *   Toekomstige prijswijzigingen in de stamdata raken historische calamiteiten NIET.
 * =============================================================================
 */
class MaakCalamiteit {
  /**
   * @param {object} deps - Geïnjecteerde afhankelijkheden (Clean Architecture)
   * @param {object} deps.calamiteitRepo
   * @param {object} deps.materieelRepo
   * @param {object} deps.rekenregelRepo
   * @param {object} deps.configuratieRepo
   * @param {object} deps.auditLogger
   */
  constructor({ calamiteitRepo, materieelRepo, rekenregelRepo, configuratieRepo, auditLogger }) {
    this.calamiteitRepo   = calamiteitRepo;
    this.materieelRepo    = materieelRepo;
    this.rekenregelRepo   = rekenregelRepo;
    this.configuratieRepo = configuratieRepo;
    this.auditLogger      = auditLogger;
  }

  /**
   * Voert de use-case uit.
   *
   * @param {object} invoer            - Ruwe wizard-invoer van de frontend
   * @param {number} gebruikerId       - ID van de ingelogde medewerker (JWT-payload)
   * @returns {Promise<{calamiteitId: number, berekeningen: object}>}
   */
  async uitvoer(invoer, gebruikerId) {
    // ── Stap 0: Normaliseer snake_case → camelCase ─────────────────────────────
    // De frontend POST stuurt veldnamen als snake_case (rijbaan_richting, klant_id,
    // etc.) conform REST-conventie. De Calamiteit domain-entiteit gebruikt camelCase.
    // Dit is de enige plek waar die mapping plaatsvindt (Clean Architecture: controller
    // → use-case is de grens tussen transport en domein).
    const genorm = {
      klantId:                  invoer.klant_id                    ?? invoer.klantId,
      rijbaanRichting:          invoer.rijbaan_richting             ?? invoer.rijbaanRichting,
      aantalStroken:            invoer.aantal_stroken               ?? invoer.aantalStroken,
      tijdstipMelding:          invoer.tijdstip_melding             ?? invoer.tijdstipMelding,
      tijdstipAanwezig:         invoer.tijdstip_aanwezig            ?? invoer.tijdstipAanwezig,
      tijdstipAfgerond:         invoer.tijdstip_afgerond            ?? invoer.tijdstipAfgerond,
      omschrijving:             invoer.omschrijving                 ?? null,
      naamInspecteurRws:        invoer.naam_inspecteur_rws          ?? invoer.naamInspecteurRws,
      tijdAangemeldVc:          invoer.tijd_aangemeld_vc            ?? invoer.tijdAangemeldVc    ?? null,
      opmerkingen:              invoer.opmerkingen                  ?? null,
      restschadeOmschrijving:   invoer.restschade_omschrijving      ?? invoer.restschadeOmschrijving,
      vervolgactie:             invoer.vervolgactie                 ?? false,
      vervolgactieOmschrijving: invoer.vervolgactie_omschrijving    ?? invoer.vervolgactieOmschrijving,
      checklistPbm:             invoer.checklist_pbm                ?? invoer.checklistPbm,
      checklistFotosCalamiteit: invoer.checklist_fotos_calamiteit   ?? invoer.checklistFotosCalamiteit,
      checklistFotosAanpak:     invoer.checklist_fotos_aanpak       ?? invoer.checklistFotosAanpak,
      checklistVeilig:          invoer.checklist_veilig             ?? invoer.checklistVeilig,
      checklistStortbon:        invoer.checklist_stortbon           ?? invoer.checklistStortbon,
    };

    // ── Stap 1: Domeinvalidatie ────────────────────────────────────────────────
    const calamiteit = new Calamiteit({ ...invoer, ...genorm, makerId: gebruikerId });
    if (!calamiteit.isVolledig()) {
      throw Object.assign(
        new Error('Calamiteit-gegevens zijn onvolledig. Controleer rijksweg, HMP, richting en stroken.'),
        { statusCode: 400 }
      );
    }

    // ── Stap 2: CROW-berekening ────────────────────────────────────────────────
    const rekenregels = await this.rekenregelRepo.haalOpOpScenario(calamiteit.aantalStroken);
    if (rekenregels.length === 0) {
      throw Object.assign(
        new Error(`Geen CROW-rekenregels gevonden voor scenario ${calamiteit.aantalStroken} stroken.`),
        { statusCode: 422 }
      );
    }

    let crowResultaten = CROWCalculator.bereken(
      calamiteit.hmp,
      calamiteit.rijbaanRichting,
      rekenregels
    );

    // Pas handmatige overrides toe als de medewerker posities heeft gewijzigd
    // Frontend stuurt 'crow_overrides', legacy noemde dit 'plaatsingen_override' — beide accepteren
    const overrides = invoer.crow_overrides ?? invoer.plaatsingen_override ?? {};
    if (Object.keys(overrides).length > 0) {
      crowResultaten = CROWCalculator.pasOverridesToe(crowResultaten, overrides);
    }

    // ── Stap 3: Materieel-tarieven ophalen voor snapshotting ──────────────────
    const materieelInvoer = invoer.materieel || [];
    const materieelSnapshots = await this._bouwMaterieelSnapshots(materieelInvoer);

    // ── Stap 4 & 5: Weekendtarieven + Strukton-berekening ────────────────────
    let berekeningen = null;
    const toeslagRegelsDb = [];

    if (calamiteit.tijdstipAanwezig && calamiteit.tijdstipAfgerond) {
      const zatConfig = await this.configuratieRepo.haalOpOpSleutel('zaterdagtoeslag_uurtarief');
      const zonConfig = await this.configuratieRepo.haalOpOpSleutel('zondagtoeslag_uurtarief');
      const tarieven  = {
        zaterdagUurtarief: zatConfig ? Number(zatConfig.waarde) : StruktuurCalculator.ZATERDAG_TOESLAG,
        zondagUurtarief:   zonConfig ? Number(zonConfig.waarde) : StruktuurCalculator.ZONDAG_TOESLAG,
      };

      berekeningen = StruktuurCalculator.berekenVolledig(
        calamiteit.tijdstipAanwezig,
        calamiteit.tijdstipAfgerond,
        tarieven
      );

      // Zet toeslagregels klaar voor DB-opslag
      for (const toeslag of berekeningen.toeslagRegels) {
        toeslagRegelsDb.push({
          naamToeslag:       toeslag.naam_toeslag,
          uurtariefSnapshot: toeslag.uurtarief_snapshot,
          aantalUren:        toeslag.aantal_uren,
        });
      }
    }

    // ── Stap 6: SQL-TRANSACTIE ─────────────────────────────────────────────────
    const calamiteitId = await withTransactie(async (conn) => {
      // a) Hoofd-record aanmaken
      const dbData = {
        maker_id:                    gebruikerId,
        klant_id:                    calamiteit.klantId,
        tijdstip_melding:            calamiteit.tijdstipMelding,
        tijdstip_aanwezig:           calamiteit.tijdstipAanwezig,
        tijdstip_afgerond:           calamiteit.tijdstipAfgerond,
        rijksweg:                    calamiteit.rijksweg,
        hmp:                         calamiteit.hmp,
        rijbaan_richting:            calamiteit.rijbaanRichting,
        aantal_stroken:              calamiteit.aantalStroken,
        omschrijving:                calamiteit.omschrijving || null,
        naam_inspecteur_rws:         calamiteit.naamInspecteurRws,
        tijd_aangemeld_vc:           calamiteit.tijdAangemeldVc || null,
        opmerkingen:                 calamiteit.opmerkingen || null,
        restschade:                  calamiteit.restschade ? 1 : 0,
        restschade_omschrijving:     calamiteit.restschadeOmschrijving,
        vervolgactie:                calamiteit.vervolgactie ? 1 : 0,
        vervolgactie_omschrijving:   calamiteit.vervolgactieOmschrijving,
        checklist_pbm:               calamiteit.checklistPbm ? 1 : 0,
        checklist_fotos_calamiteit:  calamiteit.checklistFotosCalamiteit ? 1 : 0,
        checklist_fotos_aanpak:      calamiteit.checklistFotosAanpak ? 1 : 0,
        checklist_veilig:            calamiteit.checklistVeilig ? 1 : 0,
        checklist_stortbon:          calamiteit.checklistStortbon ? 1 : 0,
        status:                      invoer.status || 'Concept',
      };
      const nieuweId = await this.calamiteitRepo.maakAan(dbData, conn);

      // b) Materieel + snapshot-tarieven
      await this.calamiteitRepo.voegMaterieelToe(nieuweId, materieelSnapshots, conn);

      // c) Toeslagen + snapshot-tarieven
      await this.calamiteitRepo.voegToeslagenToe(nieuweId, toeslagRegelsDb, conn);

      // d) Collega's
      const collegaIds = (invoer.collega_ids || []).filter((id) => id !== gebruikerId);
      await this.calamiteitRepo.voegCollegasToe(nieuweId, collegaIds, conn);

      // e) CROW-plaatsingen
      const plaatsingenDb = CROWCalculator.naarDbPlaatsingen(crowResultaten, nieuweId);
      await this.calamiteitRepo.voegPlaatsingenToe(
        nieuweId,
        plaatsingenDb.map((p) => ({
          objectNaam:  p.object_naam,
          hmpPositie:  p.hmp_positie,
          isHandmatig: p.is_handmatig,
          volgorde:    p.volgorde,
        })),
        conn
      );

      return nieuweId;
    });

    // Audit-log BUITEN de transactie (mag niet de transactie blokkeren)
    await this.auditLogger.schrijfAuditLog({
      gebruikerId,
      actie:       'INSERT',
      tabelNaam:   'Calamiteit',
      recordId:    calamiteitId,
      oudeWaarde:  null,
      nieuweWaarde: { calamiteitId, rijksweg: calamiteit.rijksweg, hmp: calamiteit.hmp },
    });

    return { calamiteitId, berekeningen };
  }

  /**
   * Haalt de actuele tarieven op voor elk materieel-item en bouwt de snapshot-objecten.
   * De snapshot bevriest de prijs op het moment van opslaan.
   *
   * @param {Array<{materieel_id: number, aantal: number}>} materieelInvoer
   * @returns {Promise<Array<{materieelId, aantal, basistariefSnapshot, uurtariefSnapshot}>>}
   */
  async _bouwMaterieelSnapshots(materieelInvoer) {
    const snapshots = [];

    for (const item of materieelInvoer) {
      const materieel = await this.materieelRepo.haalOpOpId(item.materieel_id);
      if (!materieel) {
        throw Object.assign(
          new Error(`Materieel met ID ${item.materieel_id} bestaat niet.`),
          { statusCode: 400 }
        );
      }
      snapshots.push({
        materieelId:        materieel.id,
        aantal:             item.aantal,
        basistariefSnapshot: materieel.basistarief, // Snapshot van huidig basistarief
        uurtariefSnapshot:   materieel.uurtarief,   // Snapshot van huidig uurtarief
      });
    }

    return snapshots;
  }
}

module.exports = MaakCalamiteit;
