'use strict';

/**
 * Domein-entiteit: Materieel (stamdata)
 */
class Materieel {
  constructor({ id, naam, eenheid, basistarief, uurtarief, actief }) {
    this.id          = id ?? null;
    this.naam        = naam;
    this.eenheid     = eenheid;
    this.basistarief = Number(basistarief);
    this.uurtarief   = Number(uurtarief);
    this.actief      = Boolean(actief ?? true);
  }

  /** Geeft het snapshot-object terug voor opslag in Calamiteit_Materieel */
  maakSnapshot() {
    return {
      gefactureerd_basistarief_snapshot: this.basistarief,
      gefactureerd_uurtarief_snapshot:   this.uurtarief,
    };
  }
}

module.exports = Materieel;
