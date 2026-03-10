'use strict';

/**
 * Domein-entiteit: Klant (opdrachtgever)
 */
class Klant {
  constructor({ id, naam, adres, emailFacturatie, actief }) {
    this.id              = id ?? null;
    this.naam            = naam;
    this.adres           = adres           ?? null;
    this.emailFacturatie = emailFacturatie ?? null;
    this.actief          = Boolean(actief ?? true);
  }
}

module.exports = Klant;
