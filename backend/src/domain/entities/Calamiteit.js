'use strict';

/**
 * Domein-entiteit: Calamiteit
 * Bevat alleen pure data-structuur en validatielogica.
 * Geen framework- of databaseafhankelijkheden.
 */
class Calamiteit {
  constructor({
    id, makerId, klantId, tijdstipMelding, tijdstipAanwezig, tijdstipAfgerond,
    rijksweg, hmp, rijbaanRichting, aantalStroken, omschrijving, naamInspecteurRws,
    restschade, restschadeOmschrijving, vervolgactie, vervolgactieOmschrijving,
    checklistPbm, checklistFotosCalamiteit, checklistFotosAanpak,
    checklistVeilig, checklistStortbon, status,
  }) {
    this.id                       = id ?? null;
    this.makerId                  = makerId;
    this.klantId                  = klantId;
    this.tijdstipMelding          = tijdstipMelding       ? new Date(tijdstipMelding)   : null;
    this.tijdstipAanwezig         = tijdstipAanwezig      ? new Date(tijdstipAanwezig)  : null;
    this.tijdstipAfgerond         = tijdstipAfgerond      ? new Date(tijdstipAfgerond)  : null;
    this.rijksweg                 = rijksweg;
    this.hmp                      = Number(hmp);
    this.rijbaanRichting          = rijbaanRichting;
    this.aantalStroken            = Number(aantalStroken);
    this.omschrijving             = omschrijving             ?? null;
    this.naamInspecteurRws        = naamInspecteurRws        ?? null;
    this.restschade               = Boolean(restschade);
    this.restschadeOmschrijving   = restschadeOmschrijving   ?? null;
    this.vervolgactie             = Boolean(vervolgactie);
    this.vervolgactieOmschrijving = vervolgactieOmschrijving ?? null;
    this.checklistPbm             = Boolean(checklistPbm);
    this.checklistFotosCalamiteit = Boolean(checklistFotosCalamiteit);
    this.checklistFotosAanpak     = Boolean(checklistFotosAanpak);
    this.checklistVeilig          = Boolean(checklistVeilig);
    this.checklistStortbon        = Boolean(checklistStortbon);
    this.status                   = status ?? 'Concept';
  }

  isVolledig() {
    return (
      this.makerId &&
      this.rijksweg &&
      this.hmp !== null &&
      ['Oplopend', 'Aflopend'].includes(this.rijbaanRichting) &&
      [1, 2].includes(this.aantalStroken) &&
      Boolean(this.naamInspecteurRws?.trim())
    );
  }

  isVeiligheidsChecklistCompleet() {
    return (
      this.checklistPbm &&
      this.checklistFotosCalamiteit &&
      this.checklistFotosAanpak &&
      this.checklistVeilig &&
      this.checklistStortbon
    );
  }
}

module.exports = Calamiteit;
