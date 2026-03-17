'use strict';

/**
 * calculators.test.js — Unit Tests voor domein-hulpfuncties
 *
 * Testplan:
 *   UT-01 t/m UT-04 : formatHmp       — HMP-formattering
 *   UT-05 t/m UT-07 : berekenStartHmp — Startpunt afzetting (incl. float-bug)
 *   UT-08 t/m UT-09 : nullCheck       — Lege waarden afvangen
 *   UT-10 t/m UT-14 : berekenUren     — Uren/facturatie (incl. nachtdienst-bug)
 *   UT-15           : isFacturabel    — Facturatie filter
 *   UT-16           : mergePrijs      — Snapshot constructie
 *
 * BEWUST FALENDE TESTS (Technical Debt):
 *   UT-07 : JavaScript floating-point afrondingsfout bij 100.1 - 0.6
 *   UT-14 : Nachtdienst die middernacht overschrijdt geeft negatief getal
 */

const {
  formatHmp,
  berekenStartHmp,
  berekenUren,
  nullCheck,
  isFacturabel,
  mergePrijs,
} = require('../src/domain/calculators');

// ── formatHmp ─────────────────────────────────────────────────────────────────

describe('formatHmp', () => {
  test('UT-01: punt wordt vervangen door komma', () => {
    expect(formatHmp('199.000')).toBe('199,000');
  });

  test('UT-02: waarde met komma blijft ongewijzigd', () => {
    expect(formatHmp('45,2')).toBe('45,2');
  });

  test('UT-03: spaties worden verwijderd en punt wordt komma', () => {
    expect(formatHmp(' 100 , 0 ')).toBe('100,0');
  });

  test('UT-04: waarde met letters geeft NaN terug', () => {
    expect(formatHmp('100.0a')).toBeNaN();
  });
});

// ── berekenStartHmp ───────────────────────────────────────────────────────────

describe('berekenStartHmp', () => {
  test('UT-05: richting Oplopend, offset -600 m → 99.4', () => {
    expect(berekenStartHmp(100.0, 'Oplopend', -600)).toBe(99.4);
  });

  test('UT-06: richting Aflopend, offset -600 m → 100.6', () => {
    expect(berekenStartHmp(100.0, 'Aflopend', -600)).toBe(100.6);
  });

  // BEWUST FALENDE TEST — UT-07
  // Verwacht: 99.8
  // Werkelijk: 99.80000000000001 (JavaScript float-afrondingsfout)
  // Technical Debt: berekenStartHmp() gebruikt geen .toFixed() afronding.
  // Noot: 100.1 - 0.6 geeft in Node.js 20 toevallig 99.5 exact (IEEE 754-coincidentie).
  //       100.4 - 0.6 = 99.80000000000001 demonstreert de bug aantoonbaar.
  test('UT-07: [TECHNICAL DEBT] float-bug bij 100.4 - 0.6 → verwacht 99.8 maar faalt', () => {
    expect(berekenStartHmp(100.4, 'Oplopend', -600)).toBe(99.8);
  });
});

// ── nullCheck ─────────────────────────────────────────────────────────────────

describe('nullCheck', () => {
  test('UT-08: lege array geeft "Geen" terug', () => {
    expect(nullCheck([])).toBe('Geen');
  });

  test('UT-09: undefined geeft "Niet ingevuld" terug', () => {
    expect(nullCheck(undefined)).toBe('Niet ingevuld');
  });
});

// ── berekenUren ───────────────────────────────────────────────────────────────

describe('berekenUren', () => {
  test('UT-10: 12:00 t/m 17:00 → 5.0 uur', () => {
    expect(berekenUren('12:00', '17:00')).toBe(5.0);
  });

  test('UT-11: 10:00 t/m 12:00 → minimaal 4.0 uur (Strukton regel)', () => {
    expect(berekenUren('10:00', '12:00')).toBe(4.0);
  });

  test('UT-12: 12:00 t/m 16:00 → exact 4.0 uur', () => {
    expect(berekenUren('12:00', '16:00')).toBe(4.0);
  });

  test('UT-13: 12:00 t/m 16:01 → afronding naar 4.25 uur', () => {
    expect(berekenUren('12:00', '16:01')).toBe(4.25);
  });

  // BEWUST FALENDE TEST — UT-14
  // Verwacht: 3.0 uur → door Strukton-minimum wordt dit 4.0
  // Maar de verwachting is hier 3.0 om de debt aan te tonen:
  // De functie heeft geen datum-overgangslogica. 23:00 t/m 02:00 geeft
  // 2 - 23 = -21, wat door het minimum naar 4 wordt geclipt.
  // Technical Debt: nachtdiensten die middernacht overschrijden worden
  // niet correct berekend zonder expliciete datum-informatie.
  test('UT-14: [TECHNICAL DEBT] nachtdienst 23:00 t/m 02:00 → verwacht 3.0 maar faalt', () => {
    expect(berekenUren('23:00', '02:00')).toBe(3.0);
  });
});

// ── isFacturabel ──────────────────────────────────────────────────────────────

describe('isFacturabel', () => {
  test('UT-15: "Extern Materieel" is niet facturabel', () => {
    expect(isFacturabel('Extern Materieel')).toBe(false);
  });
});

// ── mergePrijs ────────────────────────────────────────────────────────────────

describe('mergePrijs', () => {
  test('UT-16: voegt snapshot_prijs toe aan item', () => {
    expect(mergePrijs({ id: 1 }, { prijs: 50 })).toEqual({ id: 1, snapshot_prijs: 50 });
  });
});
