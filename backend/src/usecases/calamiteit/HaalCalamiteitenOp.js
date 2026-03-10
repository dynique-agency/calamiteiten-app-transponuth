'use strict';

/** Use-case: HaalCalamiteitenOp — Fase 3: volledige implementatie */
class HaalCalamiteitenOp {
  constructor({ calamiteitRepo }) {
    this.calamiteitRepo = calamiteitRepo;
  }

  async uitvoer(filters = {}) {
    return this.calamiteitRepo.haalAlleOp(filters);
  }
}

module.exports = HaalCalamiteitenOp;
