'use strict';

/**
 * Domein-entiteit: Gebruiker
 */
class Gebruiker {
  constructor({ id, externalId, naam, rol, actief }) {
    this.id         = id ?? null;
    this.externalId = externalId ?? null;
    this.naam       = naam;
    this.rol        = rol;
    this.actief     = Boolean(actief ?? true);
  }

  isAdmin() {
    return this.rol === 'Admin';
  }
}

module.exports = Gebruiker;
