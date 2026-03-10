'use strict';

/**
 * =============================================================================
 * Strukton Facturatie-rekenmodule — Fase 2
 * =============================================================================
 * Pure domeinlogica conform het Strukton-contract. Geen frameworkafhankelijkheden.
 *
 * Business rules (sectie 4):
 *
 *  1. MINIMUM FACTURATIE (4-uurs regel):
 *     Elke calamiteit wordt gefactureerd voor minimaal 4 uur (factor 1.0).
 *
 *  2. KWARTIERAFRONDING:
 *     De werkelijke duur wordt afgerond naar het dichtstbijzijnde kwartier van 15 min.
 *     Factureerbare posities: ,00 / ,25 / ,50 / ,75 uur.
 *
 *  3. FACTOR-OPBOUW boven het minimum:
 *     Elk extra kwartier (15 min) boven de 4 uur voegt 0.0625 toe aan de factor.
 *     Formule:  factor = 1.0 + (afgerond_uren − 4) / 0.25 × 0.0625
 *     Vereenvoudigd: factor = 1.0 + (afgerond_uren − 4) × 0.25
 *
 *  4. WEEKENDTOESLAGEN:
 *     Zaterdag  → +€18,75/uur  (00:00 t/m 24:00 zaterdag)
 *     Zondag    → +€28,25/uur  (zondag 00:00 t/m maandag 06:00)
 *
 * =============================================================================
 */

/**
 * @typedef {object} FactorResultaat
 * @property {number} duurMinuten     - Afgeronde duur in minuten
 * @property {number} afgerondUren    - Duur in uren (op 4 decimalen, bijv. 4.25)
 * @property {number} factor          - Facturatiefactor (min. 1.0, daarna +0.0625/kwartier)
 * @property {number} factureerbareMedewerkerUren - Totale gecorrigeerde factureerbare uren
 */

/**
 * @typedef {object} WeekendToeslagResultaat
 * @property {number} zaterdagUren    - Gewerkte uren op zaterdag
 * @property {number} zondagUren      - Gewerkte uren op zondag/maandag-ochtend
 * @property {number} zaterdagBedrag  - Totaalkosten zaterdagtoeslag (excl. uurtarief basis)
 * @property {number} zondagBedrag    - Totaalkosten zondagtoeslag (excl. uurtarief basis)
 */

/**
 * @typedef {object} VolledigResultaat
 * @property {FactorResultaat} facturatie
 * @property {WeekendToeslagResultaat} weekendToeslagen
 * @property {object[]} toeslagRegels - Klaar voor opslag in Calamiteit_Toeslag
 */

class StruktuurCalculator {
  // ── Constanten conform business rules ────────────────────────────────────────

  /** Minimum te factureren uren conform het Strukton-contract */
  static MIN_FACTURATIE_UREN = 4;

  /** Factor per extra kwartier boven het minimum (1/16) */
  static KWARTIER_FACTOR = 0.0625;

  /** 15 minuten in milliseconden */
  static KWARTIER_MS = 15 * 60 * 1000;

  /** Toeslag per uur op zaterdagen (00:00–24:00) */
  static ZATERDAG_TOESLAG = 18.75;

  /** Toeslag per uur op zondagen en maandag vóór 06:00 */
  static ZONDAG_TOESLAG = 28.25;

  // ── Privé hulpfuncties ────────────────────────────────────────────────────────

  /**
   * Valideert en converteert een start- en eindtijd.
   * Gooit een AppFout (statusCode 400) bij ongeldige invoer.
   *
   * @param {Date|string|number} startTijd
   * @param {Date|string|number} eindTijd
   * @returns {{ start: Date, eind: Date }}
   */
  static _valideerTijden(startTijd, eindTijd) {
    const start = new Date(startTijd);
    const eind  = new Date(eindTijd);

    if (!Number.isFinite(start.getTime())) {
      const fout = new Error(`Strukton: Ongeldige starttijd: '${startTijd}'.`);
      fout.statusCode = 400;
      throw fout;
    }
    if (!Number.isFinite(eind.getTime())) {
      const fout = new Error(`Strukton: Ongeldige eindtijd: '${eindTijd}'.`);
      fout.statusCode = 400;
      throw fout;
    }
    if (eind.getTime() <= start.getTime()) {
      const fout = new Error('Strukton: Eindtijd moet na de starttijd liggen.');
      fout.statusCode = 400;
      throw fout;
    }

    return { start, eind };
  }

  /**
   * Rondt een duur in milliseconden af naar het dichtstbijzijnde kwartier (15 min).
   * Toepassing: Math.round zorgt voor afronding op >,5 → omhoog, anders omlaag.
   *
   * Voorbeelden:
   *   3u 07m → 3u 00m  (7 min < helft van 15 min → afgerond naar beneden)
   *   3u 08m → 3u 15m  (8 min >= helft van 15 min → afgerond naar boven)
   *   4u 00m → 4u 00m  (precies, geen aanpassing)
   *
   * @param {number} duurMs - Tijdsduur in milliseconden
   * @returns {number} Afgeronde duur in milliseconden
   */
  static _rondfOpKwartier(duurMs) {
    return Math.round(duurMs / StruktuurCalculator.KWARTIER_MS) * StruktuurCalculator.KWARTIER_MS;
  }

  // ── Publieke methoden ─────────────────────────────────────────────────────────

  /**
   * Berekent de Strukton facturatiefactor op basis van start- en eindtijd.
   *
   * Stappen:
   *   1. Bereken de werkelijke tijdsduur
   *   2. Rond af naar het dichtstbijzijnde kwartier
   *   3. Pas de 4-uurs minimumregel toe
   *   4. Bereken de factor (1.0 + extra kwartieren × 0.0625)
   *
   * @param {Date|string|number} startTijd
   * @param {Date|string|number} eindTijd
   * @returns {FactorResultaat}
   */
  static berekenFactor(startTijd, eindTijd) {
    const { start, eind } = StruktuurCalculator._valideerTijden(startTijd, eindTijd);

    // Stap 1: Werkelijke duur
    const werkelijkMs = eind.getTime() - start.getTime();

    // Stap 2: Afronden naar dichtstbijzijnd kwartier
    const afgerondMs = StruktuurCalculator._rondfOpKwartier(werkelijkMs);

    // Zet om naar minuten en uren
    const duurMinuten  = afgerondMs / 60_000;
    const afgerondUren = duurMinuten / 60;

    // Stap 3 & 4: Factor-berekening met 4-uurs minimum
    //
    // Formule:  factor = 1.0 + (max(afgerondUren, 4) - 4) / 0.25 × 0.0625
    // Omdat:    0.0625 / 0.25 = 0.25
    // Vereenvoudigd: factor = 1.0 + max(afgerondUren - 4, 0) × 0.25
    //
    // Praktijkvoorbeelden:
    //   2 uur  → factor 1.0   (< 4 uur → minimum geldt)
    //   4 uur  → factor 1.0   (precies minimum)
    //   4,25u  → factor 1.0625 (+1 kwartier)
    //   5 uur  → factor 1.25   (+4 kwartieren)
    //   6 uur  → factor 1.50   (+8 kwartieren)
    const extraUren = Math.max(afgerondUren - StruktuurCalculator.MIN_FACTURATIE_UREN, 0);
    const factor    = 1.0 + extraUren * 0.25;

    // Factureerbare uren = maximum van werkelijke afgeronde uren en het minimum
    const factureerbareMedewerkerUren = Math.max(afgerondUren, StruktuurCalculator.MIN_FACTURATIE_UREN);

    return {
      duurMinuten:                  duurMinuten,
      afgerondUren:                 StruktuurCalculator._rond4(afgerondUren),
      factor:                       StruktuurCalculator._rond4(factor),
      factureerbareMedewerkerUren:  StruktuurCalculator._rond4(factureerbareMedewerkerUren),
    };
  }

  /**
   * Berekent de weekendtoeslaguren voor een calamiteitperiode.
   *
   * Definitie van toeslagvensters per week (lokale tijd):
   *   Zaterdagtoeslag : zaterdag 00:00 → zondag 00:00      (dag 6, volledig)
   *   Zondagtoeslag   : zondag   00:00 → maandag 06:00
   *                     (dag 0 volledig + dag 1 vóór 06:00)
   *
   * Algoritme: itereer dag voor dag over de periode. Per dag wordt de overlap
   * berekend met de [start, eind]-periode. Dit vermijdt de 900× langzamere
   * kwartier-iteratie voor lange calamiteiten.
   *
   * @param {Date|string|number} startTijd
   * @param {Date|string|number} eindTijd
   * @param {number} [zaterdagTarief]   - Overschrijft de standaard €18,75
   * @param {number} [zondagTarief]     - Overschrijft de standaard €28,25
   * @returns {WeekendToeslagResultaat}
   */
  static berekenWeekendToeslagen(startTijd, eindTijd, zaterdagTarief, zondagTarief) {
    const { start, eind } = StruktuurCalculator._valideerTijden(startTijd, eindTijd);

    const zatTarief = typeof zaterdagTarief === 'number' ? zaterdagTarief : StruktuurCalculator.ZATERDAG_TOESLAG;
    const zonTarief = typeof zondagTarief   === 'number' ? zondagTarief  : StruktuurCalculator.ZONDAG_TOESLAG;

    let zaterdagMs = 0;
    let zondagMs   = 0;

    // Stel dagcursor in op het begin van de dag van de starttijd (lokale tijd)
    const dagCursor = new Date(start);
    dagCursor.setHours(0, 0, 0, 0);

    while (dagCursor < eind) {
      // Bepaal het einde van de huidige dag
      const volgendeDag = new Date(dagCursor);
      volgendeDag.setDate(volgendeDag.getDate() + 1);

      // Overlap van de huidige dag met de calamiteitperiode
      const overlapStart = start > dagCursor ? start : dagCursor;
      const overlapEind  = eind  < volgendeDag ? eind : volgendeDag;

      if (overlapEind > overlapStart) {
        const dag        = dagCursor.getDay(); // 0=zondag, 1=maandag, ..., 6=zaterdag
        const overlapMs  = overlapEind.getTime() - overlapStart.getTime();

        if (dag === 6) {
          // ── Zaterdag: heel de dag telt als zaterdagtoeslag ──────────────────
          zaterdagMs += overlapMs;

        } else if (dag === 0) {
          // ── Zondag: heel de dag telt als zondagtoeslag ─────────────────────
          zondagMs += overlapMs;

        } else if (dag === 1) {
          // ── Maandag: alleen het deel vóór 06:00 telt als zondagtoeslag ─────
          // (zondag-nacht loopt door tot maandag 06:00, conform business rules)
          const maandagGrens = new Date(dagCursor);
          maandagGrens.setHours(6, 0, 0, 0);

          // Overlap van de calamiteitperiode met [maandagStart, maandag 06:00]
          const toeslagStart = overlapStart;
          const toeslagEind  = overlapEind < maandagGrens ? overlapEind : maandagGrens;

          if (toeslagEind > toeslagStart) {
            zondagMs += toeslagEind.getTime() - toeslagStart.getTime();
          }
        }
        // Weekdagen (ma na 06:00, di, wo, do, vr) → geen toeslag
      }

      // Zet dagcursor door naar de volgende dag
      dagCursor.setDate(dagCursor.getDate() + 1);
    }

    // Omzetten van ms naar uren (4 decimalen)
    const zaterdagUren = StruktuurCalculator._rond4(zaterdagMs / 3_600_000);
    const zondagUren   = StruktuurCalculator._rond4(zondagMs   / 3_600_000);

    return {
      zaterdagUren,
      zondagUren,
      zaterdagBedrag: StruktuurCalculator._rond2(zaterdagUren * zatTarief),
      zondagBedrag:   StruktuurCalculator._rond2(zondagUren   * zonTarief),
    };
  }

  /**
   * Voert de volledige Strukton-berekening uit: factor + weekendtoeslagen.
   * Dit is de hoofdmethode die door de use-case wordt aangeroepen.
   *
   * @param {Date|string|number} startTijd
   * @param {Date|string|number} eindTijd
   * @param {object} [tarieven] - Overschrijf standaardtarieven vanuit de DB
   * @param {number} [tarieven.zaterdagUurtarief]
   * @param {number} [tarieven.zondagUurtarief]
   * @returns {VolledigResultaat}
   */
  static berekenVolledig(startTijd, eindTijd, tarieven = {}) {
    const facturatie      = StruktuurCalculator.berekenFactor(startTijd, eindTijd);
    const weekendToeslagen = StruktuurCalculator.berekenWeekendToeslagen(
      startTijd,
      eindTijd,
      tarieven.zaterdagUurtarief,
      tarieven.zondagUurtarief
    );

    // Bouw de toeslagregels klaar voor opslag in Calamiteit_Toeslag
    const toeslagRegels = [];

    if (weekendToeslagen.zaterdagUren > 0) {
      toeslagRegels.push({
        naam_toeslag:       'Zaterdagtoeslag',
        uurtarief_snapshot: tarieven.zaterdagUurtarief ?? StruktuurCalculator.ZATERDAG_TOESLAG,
        aantal_uren:        weekendToeslagen.zaterdagUren,
      });
    }

    if (weekendToeslagen.zondagUren > 0) {
      toeslagRegels.push({
        naam_toeslag:       'Zondagtoeslag',
        uurtarief_snapshot: tarieven.zondagUurtarief ?? StruktuurCalculator.ZONDAG_TOESLAG,
        aantal_uren:        weekendToeslagen.zondagUren,
      });
    }

    return { facturatie, weekendToeslagen, toeslagRegels };
  }

  // ── Interne hulpfuncties voor afronding ──────────────────────────────────────

  /** Afronding op 4 decimalen (voor uren en factor) */
  static _rond4(waarde) {
    return Number(waarde.toFixed(4));
  }

  /** Afronding op 2 decimalen (voor geldbedragen) */
  static _rond2(waarde) {
    return Number(waarde.toFixed(2));
  }
}

module.exports = StruktuurCalculator;
