'use strict';

/**
 * =============================================================================
 * Excel Generator — Kostenoverzicht Planbaar Werk (Klantformat)
 * =============================================================================
 * Genereert een Excel-werkboek in het exacte facturatieformaat van Transpo-Nuth.
 *
 * Layout van het werkblad "Kostenoverzicht":
 *   Rij 1  — Titel: "KOSTENOVERZICHT - PLANBAAR WERK"
 *   Rij 3  — Datumvan / Jaar / Adres
 *   Rij 4  — Datumtot / Weeknr / Klant
 *   Rij 6  — Kolomkoppen
 *   Rij 7+ — Data: één rij per medewerker én één rij per materieelregel per calamiteit
 *
 * Business rules:
 *   - Medewerkers: Strukton factureerbare uren via StruktuurCalculator
 *   - Standaard medewerker uurtarief = €37.50 (fallback als er geen tarief is)
 *   - Materieel: snapshot-prijzen (nooit de huidige stamdata)
 *   - Valutaopmaak: € #,##0.00
 * =============================================================================
 */

const ExcelJS             = require('exceljs');
const StruktuurCalculator = require('../../domain/calculators/StruktuurCalculator');

// ── Constanten ────────────────────────────────────────────────────────────────

const STANDAARD_MEDEWERKER_UURTARIEF = 37.50;   // Fallback uurtarief per medewerker
const BEDRIJFSADRES                  = 'Economiestraat 3, 6361 KD Nuth.';

// Kleuren (ARGB-formaat voor ExcelJS)
const KLEUR_DONKERBLAUW = 'FF1A3C6E';
const KLEUR_LICHTBLAUW  = 'FFE8EFF8';
const KLEUR_ORANJE      = 'FFF97316';
const KLEUR_WIT         = 'FFFFFFFF';
const KLEUR_LICHTGRIJS  = 'FFF8F9FA';
const KLEUR_TEKST       = 'FF1E2A3A';
const KLEUR_RAND        = 'FFD1D5DB';
const KLEUR_GROEN       = 'FF16A34A';

// ── Hoofdfunctie ──────────────────────────────────────────────────────────────

/**
 * Genereert het Kostenoverzicht als Excel-buffer.
 *
 * @param {object[]} calamiteiten - Volledig opgehaalde calamiteiten (incl. materieel, collegas)
 * @param {object}   opties
 * @param {number}   opties.jaar
 * @param {number}   opties.week
 * @param {Date}     opties.startDatum
 * @param {Date}     opties.eindDatum
 * @param {string}   [opties.klantNaam]
 * @returns {Promise<Buffer>}
 */
async function genereerKostenoverzicht(calamiteiten, opties = {}) {
  const werkboek    = new ExcelJS.Workbook();
  werkboek.creator  = 'Transpo-Nuth BV — Calamiteiten App';
  werkboek.created  = new Date();

  _vulKostenoverzichtBlad(werkboek, calamiteiten, opties);

  return werkboek.xlsx.writeBuffer();
}

// ── Enkel werkblad ────────────────────────────────────────────────────────────

function _vulKostenoverzichtBlad(werkboek, calamiteiten, opties) {
  const { jaar, week, startDatum, eindDatum, klantNaam = 'Alle' } = opties;

  const blad = werkboek.addWorksheet('Kostenoverzicht', {
    views:      [{ state: 'frozen', ySplit: 6 }],
    properties: { defaultRowHeight: 16 },
  });

  // ── Kolombreedtes instellen ────────────────────────────────────────────────
  blad.columns = [
    { key: 'datum',        width: 14 },   // A
    { key: 'artikel',      width: 32 },   // B
    { key: 'aantal',       width: 10 },   // C
    { key: 'eenheid',      width: 12 },   // D
    { key: 'prijs',        width: 12 },   // E
    { key: 'bedrag',       width: 14 },   // F
    { key: 'medewerker',   width: 22 },   // G
    { key: 'notitie',      width: 28 },   // H
  ];

  // ── Rij 1: Hoofdtitel ─────────────────────────────────────────────────────
  blad.mergeCells('A1:H1');
  const titelCel = blad.getCell('A1');
  titelCel.value = 'KOSTENOVERZICHT - PLANBAAR WERK';
  _stijl(titelCel, { vet: true, grootte: 14, achtergrond: KLEUR_DONKERBLAUW, tekstkleur: KLEUR_WIT, uitlijning: 'center' });
  blad.getRow(1).height = 26;

  // ── Rij 2: Leeg ───────────────────────────────────────────────────────────
  blad.getRow(2).height = 6;

  // ── Rij 3: Datum van / Jaar / Adres ───────────────────────────────────────
  const rij3 = blad.getRow(3);
  rij3.height = 18;

  const cel3A = rij3.getCell('A'); cel3A.value = 'Datum van:';
  _stijl(cel3A, { vet: true, grootte: 10, tekstkleur: KLEUR_TEKST });

  const cel3B = rij3.getCell('B');
  cel3B.value  = startDatum ? new Date(startDatum) : '';
  cel3B.numFmt = 'dd-mm-yyyy';
  _stijl(cel3B, { grootte: 10 });

  const cel3D = rij3.getCell('D'); cel3D.value = 'Jaar:';
  _stijl(cel3D, { vet: true, grootte: 10 });

  const cel3E = rij3.getCell('E'); cel3E.value = jaar ?? '';
  _stijl(cel3E, { grootte: 10 });

  const cel3G = rij3.getCell('G'); cel3G.value = BEDRIJFSADRES;
  _stijl(cel3G, { grootte: 9, tekstkleur: 'FF6B7280' });

  // ── Rij 4: Datum tot / Weeknr / Klant ────────────────────────────────────
  const rij4 = blad.getRow(4);
  rij4.height = 18;

  const cel4A = rij4.getCell('A'); cel4A.value = 'Datum tot:';
  _stijl(cel4A, { vet: true, grootte: 10 });

  const cel4B = rij4.getCell('B');
  cel4B.value  = eindDatum ? new Date(eindDatum) : '';
  cel4B.numFmt = 'dd-mm-yyyy';
  _stijl(cel4B, { grootte: 10 });

  const cel4D = rij4.getCell('D'); cel4D.value = 'Weeknr:';
  _stijl(cel4D, { vet: true, grootte: 10 });

  const cel4E = rij4.getCell('E'); cel4E.value = week ?? '';
  _stijl(cel4E, { grootte: 10 });

  const cel4G = rij4.getCell('G'); cel4G.value = 'Klant:';
  _stijl(cel4G, { vet: true, grootte: 10 });

  const cel4H = rij4.getCell('H'); cel4H.value = klantNaam;
  _stijl(cel4H, { grootte: 10 });

  // ── Rij 5: Leeg ───────────────────────────────────────────────────────────
  blad.getRow(5).height = 6;

  // ── Rij 6: Kolomkoppen ────────────────────────────────────────────────────
  const rij6    = blad.getRow(6);
  rij6.height   = 22;
  const kolomKoppen = ['Datum', 'Artikel & omschrijving', 'Aantal', 'Eenheid', 'Prijs', 'Bedrag', 'Medewerker', 'Notitie'];
  kolomKoppen.forEach((kop, i) => {
    const cel = rij6.getCell(i + 1);
    cel.value = kop;
    _stijl(cel, {
      vet: true, grootte: 10,
      achtergrond: KLEUR_DONKERBLAUW, tekstkleur: KLEUR_WIT,
      uitlijning: i >= 2 && i <= 5 ? 'center' : 'left',
      omlijning: true,
    });
  });

  // ── Data: één blok per calamiteit ─────────────────────────────────────────
  let rijTeller    = 0;  // voor afwisselende rijkleur
  let eindBedrag   = 0;

  calamiteiten.forEach((cal) => {
    // ── Berekening factureerbare uren via StruktuurCalculator ────────────────
    let factureerbareUren = 4.0;  // Minimale facturering = 4 uur
    if (cal.tijdstip_aanwezig && cal.tijdstip_afgerond) {
      try {
        const calc        = StruktuurCalculator.berekenFactor(cal.tijdstip_aanwezig, cal.tijdstip_afgerond);
        factureerbareUren = calc.factureerbareMedewerkerUren ?? 4.0;
      } catch { /* Ongeldige tijden — val terug op 4 uur */ }
    }

    // Notitietekst met locatieinfo (wordt hergebruikt op elke rij van deze calamiteit)
    const notitie = `${cal.rijksweg ?? ''} km ${cal.hmp ?? ''} — #${cal.id}`.trim();

    // Datum van de calamiteit
    const calDatum = cal.tijdstip_aanwezig
      ? new Date(cal.tijdstip_aanwezig)
      : (cal.tijdstip_melding ? new Date(cal.tijdstip_melding) : null);

    // ── Medewerkers ──────────────────────────────────────────────────────────
    // Bouw lijst van alle medewerkers: maker + eventuele collega's uit junction
    const allePersonen = [];

    // Maker altijd als eerste toevoegen
    if (cal.maker_naam || cal.maker_id) {
      allePersonen.push(cal.maker_naam ?? `Medewerker #${cal.maker_id}`);
    }

    // Collega's uit de Calamiteit_Collega junction
    (cal.collegas || []).forEach((c) => {
      const naam = c.naam ?? `Medewerker #${c.gebruiker_id ?? c.id}`;
      if (!allePersonen.includes(naam)) {
        allePersonen.push(naam);
      }
    });

    // Als er geen medewerkers zijn, voeg één anonieme rij toe zodat de calamiteit zichtbaar blijft
    if (allePersonen.length === 0) allePersonen.push('Onbekend');

    allePersonen.forEach((naam) => {
      const prijs  = STANDAARD_MEDEWERKER_UURTARIEF;
      const bedrag = factureerbareUren * prijs;
      eindBedrag  += bedrag;

      const rij = _voegDataRijToe(blad, rijTeller++, {
        datum:      calDatum,
        artikel:    'Medewerker',
        aantal:     factureerbareUren,
        eenheid:    'per uur',
        prijs,
        bedrag,
        medewerker: naam,
        notitie,
      });
      _formatteerDataRij(rij);
    });

    // ── Materieel ────────────────────────────────────────────────────────────
    (cal.materieel || []).forEach((m) => {
      // Bepaal juiste snapshot-prijs: uurtarief als beschikbaar, anders basistarief
      const snapshotPrijs = (m.gefactureerd_uurtarief_snapshot > 0)
        ? m.gefactureerd_uurtarief_snapshot
        : m.gefactureerd_basistarief_snapshot;

      const eenheid = m.eenheid ?? 'per stuk';
      const aantal  = m.aantal  ?? 1;
      const bedrag  = aantal * snapshotPrijs;
      eindBedrag   += bedrag;

      const rij = _voegDataRijToe(blad, rijTeller++, {
        datum:      calDatum,
        artikel:    m.materieel_naam ?? m.naam ?? `Materieel #${m.materieel_id}`,
        aantal,
        eenheid,
        prijs:      snapshotPrijs,
        bedrag,
        medewerker: allePersonen[0] ?? '',   // Eerste medewerker ter referentie
        notitie,
      });
      _formatteerDataRij(rij);
    });

    // ── Toeslagen ────────────────────────────────────────────────────────────
    (cal.toeslagen || []).forEach((t) => {
      const bedrag = t.aantal_uren * t.uurtarief_snapshot;
      eindBedrag  += bedrag;

      const rij = _voegDataRijToe(blad, rijTeller++, {
        datum:      calDatum,
        artikel:    t.naam_toeslag,
        aantal:     t.aantal_uren,
        eenheid:    'per uur',
        prijs:      t.uurtarief_snapshot,
        bedrag,
        medewerker: allePersonen[0] ?? '',
        notitie,
      });
      _formatteerDataRij(rij);
    });
  });

  // ── Totaalrij ─────────────────────────────────────────────────────────────
  const totaalRij   = blad.addRow({});
  totaalRij.height  = 22;

  const totaalLabelCel = totaalRij.getCell('E');
  totaalLabelCel.value = 'TOTAAL';
  _stijl(totaalLabelCel, { vet: true, grootte: 10, achtergrond: KLEUR_DONKERBLAUW, tekstkleur: KLEUR_WIT, uitlijning: 'right', omlijning: true });

  const totaalBedragCel   = totaalRij.getCell('F');
  totaalBedragCel.value   = eindBedrag;
  totaalBedragCel.numFmt  = '"€" #,##0.00';
  _stijl(totaalBedragCel, { vet: true, grootte: 11, achtergrond: KLEUR_GROEN, tekstkleur: KLEUR_WIT, uitlijning: 'right', omlijning: true });

  // Lege cellen in totaalrij ook stijlen
  ['A','B','C','D','G','H'].forEach((kol) => {
    const cel = totaalRij.getCell(kol);
    _stijl(cel, { achtergrond: KLEUR_DONKERBLAUW, omlijning: true });
  });

  // ── Lege rij als buffer ───────────────────────────────────────────────────
  if (calamiteiten.length === 0) {
    const legeRij = blad.addRow({});
    const leegCel = legeRij.getCell('B');
    leegCel.value = 'Geen calamiteiten gevonden voor deze week.';
    _stijl(leegCel, { grootte: 10, tekstkleur: 'FF9CA3AF' });
  }
}

// ── Hulpfuncties ──────────────────────────────────────────────────────────────

/**
 * Voegt één datacelrij toe aan het werkblad.
 * Retourneert de ExcelJS-rij voor verdere styling.
 */
function _voegDataRijToe(blad, rijIndex, { datum, artikel, aantal, eenheid, prijs, bedrag, medewerker, notitie }) {
  return blad.addRow({
    datum,
    artikel,
    aantal,
    eenheid,
    prijs,
    bedrag,
    medewerker,
    notitie,
  });
}

/**
 * Past consistente opmaak toe op een datacelrij (rij 7+).
 */
function _formatteerDataRij(rij) {
  rij.height = 16;
  rij.eachCell({ includeEmpty: true }, (cel, colNr) => {
    const isOneven    = (rij.number % 2 === 1);
    const achtergrond = isOneven ? KLEUR_WIT : KLEUR_LICHTGRIJS;

    _stijl(cel, { grootte: 10, achtergrond, omlijning: true });

    // Kolom A: datum
    if (colNr === 1 && cel.value instanceof Date) {
      cel.numFmt    = 'dd-mm-yyyy';
      cel.alignment = { horizontal: 'left', vertical: 'middle' };
    }
    // Kolom C: aantal (4 decimalen voor uren)
    if (colNr === 3 && typeof cel.value === 'number') {
      cel.numFmt    = '#,##0.00##';
      cel.alignment = { horizontal: 'center', vertical: 'middle' };
    }
    // Kolom D: eenheid
    if (colNr === 4) {
      cel.alignment = { horizontal: 'center', vertical: 'middle' };
    }
    // Kolommen E (prijs) en F (bedrag): valuta-opmaak
    if (colNr === 5 && typeof cel.value === 'number') {
      cel.numFmt    = '"€" #,##0.00';
      cel.alignment = { horizontal: 'right', vertical: 'middle' };
    }
    if (colNr === 6 && typeof cel.value === 'number') {
      cel.numFmt    = '"€" #,##0.00';
      cel.alignment = { horizontal: 'right', vertical: 'middle' };
      cel.font      = { bold: true, size: 10, name: 'Calibri', color: { argb: KLEUR_TEKST } };
    }
  });
}

/**
 * Past consistente styling toe op een ExcelJS-cel.
 */
function _stijl(cel, {
  vet        = false,
  grootte    = 10,
  achtergrond,
  tekstkleur  = KLEUR_TEKST,
  uitlijning  = 'left',
  omlijning   = false,
} = {}) {
  cel.font = {
    bold:  vet,
    size:  grootte,
    color: { argb: tekstkleur },
    name:  'Calibri',
  };
  if (achtergrond) {
    cel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: achtergrond } };
  }
  cel.alignment = { horizontal: uitlijning, vertical: 'middle', wrapText: false };
  if (omlijning) {
    const rand = { style: 'thin', color: { argb: KLEUR_RAND } };
    cel.border = { top: rand, left: rand, bottom: rand, right: rand };
  }
}

module.exports = { genereerKostenoverzicht };
