'use strict';

const { withTransactie }  = require('../../infrastructure/db/verbinding');
const CROWCalculator      = require('../../domain/calculators/CROWCalculator');
const StruktuurCalculator = require('../../domain/calculators/StruktuurCalculator');

/**
 * =============================================================================
 * Use-case: WijzigCalamiteit — Admin Correctiemodus — Fase 3
 * =============================================================================
 * Stelt een Admin in staat om een bestaande calamiteit te corrigeren.
 *
 * Beperkingen:
 *   - Alleen Admins mogen corrigeren (gehandhaafd in de controller via RBAC).
 *   - Een 'Ingezonden' calamiteit kan worden teruggezet naar 'Concept' via
 *     de status-patch — overige velden zijn dan aanpasbaar.
 *   - Bij herberekening van CROW of Strukton worden de oude junction-data
 *     vervangen (ook de snapshots) — dit is een bewuste Admin-actie.
 *   - Elke correctie wordt volledig geauditeerd.
 *
 * Modi:
 *   1. Basis-velden corrigeren (tijden, locatie, checklist, status)
 *   2. Volledige herberekening met nieuw materieel (herberekent snapshots + toeslagen)
 * =============================================================================
 */
class WijzigCalamiteit {
  constructor({ calamiteitRepo, materieelRepo, rekenregelRepo, configuratieRepo, auditLogger }) {
    this.calamiteitRepo   = calamiteitRepo;
    this.materieelRepo    = materieelRepo;
    this.rekenregelRepo   = rekenregelRepo;
    this.configuratieRepo = configuratieRepo;
    this.auditLogger      = auditLogger;
  }

  /**
   * Voert een basis-correctie uit op veld-niveau.
   * Vervangt geen junction-data (materieel/toeslagen/plaatsingen).
   *
   * @param {number} id
   * @param {object} wijzigingen - Alleen toegestane velden
   * @param {number} gebruikerId
   */
  async wijzigBasisVelden(id, wijzigingen, gebruikerId) {
    const bestaand = await this.calamiteitRepo.haalOpOpId(id);
    if (!bestaand) {
      throw Object.assign(new Error(`Calamiteit ${id} niet gevonden.`), { statusCode: 404 });
    }

    // Gefilterd: alleen de correctie-velden die een admin mag aanpassen
    const toegestaneVelden = [
      'klant_id', 'tijdstip_melding', 'tijdstip_aanwezig', 'tijdstip_afgerond',
      'rijksweg', 'hmp', 'rijbaan_richting', 'aantal_stroken',
      'naam_inspecteur_rws', 'tijd_aangemeld_vc',
      'omschrijving', 'opmerkingen',
      'restschade', 'restschade_omschrijving',
      'vervolgactie', 'vervolgactie_omschrijving',
      'checklist_pbm', 'checklist_fotos_calamiteit', 'checklist_fotos_aanpak',
      'checklist_veilig', 'checklist_stortbon', 'status',
    ];
    const gefilterdeWijzigingen = Object.fromEntries(
      Object.entries(wijzigingen).filter(([k]) => toegestaneVelden.includes(k))
    );

    if (Object.keys(gefilterdeWijzigingen).length === 0) {
      throw Object.assign(new Error('Geen geldige velden opgegeven voor correctie.'), { statusCode: 400 });
    }

    await this.calamiteitRepo.wijzig(id, gefilterdeWijzigingen);

    await this.auditLogger.schrijfAuditLog({
      gebruikerId,
      actie:       'UPDATE',
      tabelNaam:   'calamiteit',
      recordId:    id,
      oudeWaarde:  bestaand,
      nieuweWaarde: gefilterdeWijzigingen,
    });
  }

  /**
   * Herberekent en vervangt alle junction-data (materieel, toeslagen, plaatsingen).
   * Gebruikt wanneer de Admin nieuwe materieel-items of tijden corrigeert.
   *
   * WAARSCHUWING: De bestaande snapshots worden vervangen door de actuele tarieven
   * op het moment van herberekening. Dit is een bewuste Admin-actie.
   *
   * @param {number} id
   * @param {object} invoer - Volledige wizard-invoer (inclusief materieel, plaatsingen)
   * @param {number} gebruikerId
   */
  async herbereken(id, invoer, gebruikerId) {
    const bestaand = await this.calamiteitRepo.haalOpOpId(id);
    if (!bestaand) {
      throw Object.assign(new Error(`Calamiteit ${id} niet gevonden.`), { statusCode: 404 });
    }

    // ── CROW herberekening ─────────────────────────────────────────────────────
    const aantalStroken = invoer.aantal_stroken || bestaand.aantal_stroken;
    const rekenregels   = await this.rekenregelRepo.haalOpOpScenario(aantalStroken);
    const hmp           = invoer.hmp             || bestaand.hmp;
    const richting      = invoer.rijbaan_richting || bestaand.rijbaan_richting;

    let crowResultaten = CROWCalculator.bereken(hmp, richting, rekenregels);
    if (invoer.plaatsingen_override) {
      crowResultaten = CROWCalculator.pasOverridesToe(crowResultaten, invoer.plaatsingen_override);
    }

    // ── Materieel-snapshots ────────────────────────────────────────────────────
    const materieelSnapshots = [];
    for (const item of (invoer.materieel || [])) {
      const mat = await this.materieelRepo.haalOpOpId(item.materieel_id);
      if (!mat) throw Object.assign(new Error(`Materieel ${item.materieel_id} niet gevonden.`), { statusCode: 400 });
      materieelSnapshots.push({
        materieelId:         mat.id,
        aantal:              item.aantal,
        basistariefSnapshot: mat.basistarief,
        uurtariefSnapshot:   mat.uurtarief,
      });
    }

    // ── Strukton-herberekening ─────────────────────────────────────────────────
    const aanwezig  = invoer.tijdstip_aanwezig  || bestaand.tijdstip_aanwezig;
    const afgerond  = invoer.tijdstip_afgerond  || bestaand.tijdstip_afgerond;
    const toeslagRegelsDb = [];

    if (aanwezig && afgerond) {
      const zatConf = await this.configuratieRepo.haalOpOpSleutel('zaterdagtoeslag_uurtarief');
      const zonConf = await this.configuratieRepo.haalOpOpSleutel('zondagtoeslag_uurtarief');
      const tarieven = {
        zaterdagUurtarief: zatConf ? Number(zatConf.waarde) : StruktuurCalculator.ZATERDAG_TOESLAG,
        zondagUurtarief:   zonConf ? Number(zonConf.waarde) : StruktuurCalculator.ZONDAG_TOESLAG,
      };
      const berekeningen = StruktuurCalculator.berekenVolledig(aanwezig, afgerond, tarieven);
      for (const t of berekeningen.toeslagRegels) {
        toeslagRegelsDb.push({
          naamToeslag:       t.naam_toeslag,
          uurtariefSnapshot: t.uurtarief_snapshot,
          aantalUren:        t.aantal_uren,
        });
      }
    }

    // ── Transactie: verwijder oud + sla nieuw op ───────────────────────────────
    await withTransactie(async (conn) => {
      // Basis-velden bijwerken
      const basisWijzigingen = {};
      for (const veld of [
        'klant_id','tijdstip_melding','tijdstip_aanwezig','tijdstip_afgerond',
        'rijksweg','hmp','rijbaan_richting','aantal_stroken','naam_inspecteur_rws','tijd_aangemeld_vc',
        'omschrijving','opmerkingen',
        'restschade','restschade_omschrijving','vervolgactie','vervolgactie_omschrijving',
        'checklist_pbm','checklist_fotos_calamiteit','checklist_fotos_aanpak',
        'checklist_veilig','checklist_stortbon','status',
      ]) {
        if (invoer[veld] !== undefined) basisWijzigingen[veld] = invoer[veld];
      }
      if (Object.keys(basisWijzigingen).length > 0) {
        await this.calamiteitRepo.wijzig(id, basisWijzigingen, conn);
      }

      // Vervang alle junction-data
      await this.calamiteitRepo.verwijderMaterieel(id, conn);
      await this.calamiteitRepo.verwijderToeslagen(id, conn);
      await this.calamiteitRepo.verwijderPlaatsingen(id, conn);
      await this.calamiteitRepo.verwijderCollegas(id, conn);

      await this.calamiteitRepo.voegMaterieelToe(id, materieelSnapshots, conn);
      await this.calamiteitRepo.voegToeslagenToe(id, toeslagRegelsDb, conn);

      const collegaIds = (invoer.collega_ids || []).filter((uid) => uid !== bestaand.maker_id);
      await this.calamiteitRepo.voegCollegasToe(id, collegaIds, conn);

      const plaatsingenDb = CROWCalculator.naarDbPlaatsingen(crowResultaten, id);
      await this.calamiteitRepo.voegPlaatsingenToe(
        id,
        plaatsingenDb.map((p) => ({
          objectNaam:  p.object_naam,
          hmpPositie:  p.hmp_positie,
          isHandmatig: p.is_handmatig,
          volgorde:    p.volgorde,
        })),
        conn
      );
    });

    await this.auditLogger.schrijfAuditLog({
      gebruikerId,
      actie:       'UPDATE',
      tabelNaam:   'calamiteit',
      recordId:    id,
      oudeWaarde:  bestaand,
      nieuweWaarde: { ...invoer, herberekend: true },
    });
  }
}

module.exports = WijzigCalamiteit;
