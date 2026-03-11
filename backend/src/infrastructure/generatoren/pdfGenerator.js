'use strict';

/**
 * =============================================================================
 * PDF Generator — Calamiteiten Rapport
 * =============================================================================
 * Genereert een professioneel calamiteiten-rapport met PDFKit.
 *
 * Structuur van het PDF-document (A4 staand):
 *   - Koptekst + Calamiteit-gegevens + Omschrijving
 *   - CROW-plaatsingen tabel
 *   - Ingezet materieel (zonder prijskolommen — alleen naam, eenheid, aantal)
 *   - Restschade & Vervolgactie
 *   - Veiligheidschecklist (compact, visuele checkboxjes)
 *   - Opmerkingen / Afwijkingen sectie
 *   - Foto-pagina's (A5-formaat: 2 per pagina)
 *
 * Foto-formaat (business rules sectie 5):
 *   Op een A4 pagina (595 × 842 pt, inclusief marges):
 *     Breedte:  515 pt  /  Hoogte: ~371 pt per foto (2 per pagina)
 * =============================================================================
 */

const PDFDocument = require('pdfkit');
const path        = require('path');
const fs          = require('fs');

// ── Layoutconstanten (PDFKit-punten) ──────────────────────────────────────────
const MARGE       = 40;
const PAGINA_B    = 595.28;
const PAGINA_H    = 841.89;
const INHOUD_B    = PAGINA_B - MARGE * 2;
const FOTO_HOOGTE = (PAGINA_H - MARGE * 3) / 2;
const KOP_HOOGTE  = 70;
const TABEL_RIJ_H = 20;

// ── Kleurenpalet — Transpo-Nuth huisstijl ─────────────────────────────────────
const KLEUR_PRIMAIR = '#1A3C6E';
const KLEUR_ACCENT  = '#F97316';
const KLEUR_LICHT   = '#F0F4FA';
const KLEUR_TEKST   = '#1E2A3A';
const KLEUR_GRIJS   = '#6B7280';
const KLEUR_GROEN   = '#16A34A';
const KLEUR_ROOD    = '#DC2626';

// ── Hoofdfunctie ──────────────────────────────────────────────────────────────

/**
 * Genereert het volledige calamiteiten-rapport als PDF-buffer.
 *
 * @param {object}  calamiteit         - Volledig calamiteit-object
 * @param {object}  [opties]
 * @param {boolean} [opties.inclusiefFotos=true]
 * @returns {Promise<Buffer>}
 */
async function genereerCalamiteitPDF(calamiteit, opties = {}) {
  const { inclusiefFotos = true } = opties;

  return new Promise((resolve, reject) => {
    const buffers = [];
    const doc = new PDFDocument({
      size:     'A4',
      margin:   MARGE,
      compress: true,
      info: {
        Title:   `Calamiteit ${calamiteit.id} — ${calamiteit.rijksweg}`,
        Author:  'Transpo-Nuth BV',
        Subject: 'Calamiteiten Rapport',
        Creator: 'Calamiteiten App Transpo-Nuth',
      },
    });

    doc.on('data',  (chunk) => buffers.push(chunk));
    doc.on('end',   () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    try {
      // Zorg dat alle array-velden nooit undefined zijn zodat de secties niet crashen
      const cal = {
        ...calamiteit,
        plaatsingen: calamiteit.plaatsingen ?? [],
        materieel:   calamiteit.materieel   ?? [],
        toeslagen:   calamiteit.toeslagen   ?? [],
        collegas:    calamiteit.collegas    ?? [],
        fotos:       calamiteit.fotos       ?? [],
      };

      _tekenKoptekst(doc, cal);
      _tekenCalamiteitGegevens(doc, cal);
      _tekenOmschrijving(doc, cal);
      _tekenOpmerkingen(doc, cal);
      _tekenCROWPlaatsingen(doc, cal.plaatsingen);
      _tekenMaterieel(doc, cal);
      _tekenRestschadeEnVervolgactie(doc, cal);
      _tekenVeiligheidschecklist(doc, cal);

      if (inclusiefFotos && cal.fotos.length > 0) {
        _tekenFotos(doc, cal.fotos);
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ── Koptekst ──────────────────────────────────────────────────────────────────

function _tekenKoptekst(doc, calamiteit) {
  doc.rect(MARGE, MARGE, INHOUD_B, KOP_HOOGTE).fill(KLEUR_PRIMAIR);

  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(18)
     .text('TRANSPO-NUTH BV', MARGE + 12, MARGE + 14);
  doc.font('Helvetica').fontSize(9).fillColor('#B0C4DE')
     .text('Calamiteiten Rapport — Buitendienst', MARGE + 12, MARGE + 36);

  const badgeX = MARGE + INHOUD_B - 130;
  doc.rect(badgeX, MARGE + 10, 120, 50).fill(KLEUR_ACCENT);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(11)
     .text('CALAMITEIT', badgeX + 8, MARGE + 16);
  doc.fontSize(20).text(`#${String(calamiteit.id).padStart(4, '0')}`, badgeX + 8, MARGE + 30);

  doc.moveDown(0.5).fillColor(KLEUR_TEKST);
}

// ── Calamiteit basisgegevens ──────────────────────────────────────────────────

function _tekenCalamiteitGegevens(doc, cal) {
  _sectionHeader(doc, 'CALAMITEIT GEGEVENS');

  const y0    = doc.y;
  const kolB  = INHOUD_B / 2 - 10;
  const kol1X = MARGE;
  const kol2X = MARGE + INHOUD_B / 2 + 10;

  // Zet de DB-waarde om naar een gebruiksvriendelijk richtinglabel
  const richtingLabel = cal.rijbaan_richting === 'Oplopend'
    ? 'Rechts (Oplopend)'
    : cal.rijbaan_richting === 'Aflopend'
      ? 'Links (Aflopend)'
      : (cal.rijbaan_richting ?? '—');

  const links = [
    ['Rijksweg',  cal.rijksweg              ?? '—'],
    ['HMP (km)',  cal.hmp != null ? String(cal.hmp) : '—'],
    ['Richting',  richtingLabel],
    ['Stroken',   cal.aantal_stroken != null ? String(cal.aantal_stroken) : '—'],
    ['Status',    cal.status                ?? '—'],
    ['Klant',     cal.klant_naam            || '— Onbekende opdrachtgever —'],
  ];
  const rechts = [
    ['Melding',        _formatteerDatum(cal.tijdstip_melding)],
    ['Aanwezig',       _formatteerDatum(cal.tijdstip_aanwezig)],
    ['Afgerond',       _formatteerDatum(cal.tijdstip_afgerond)],
    ['Aangemeld VC',   _formatteerDatum(cal.tijd_aangemeld_vc)],
    ['Inspecteur RWS', cal.naam_inspecteur_rws || '—'],
    ['Medewerker',     cal.maker_naam || (cal.maker_id ? String(cal.maker_id) : '—')],
    ['Collega\'s',     (Array.isArray(cal.collegas) ? cal.collegas : [])
                         .map((c) => c?.naam).filter(Boolean).join(', ') || '—'],
  ];

  links.forEach(([label, waarde], i) => {
    _veldRij(doc, kol1X, y0 + i * 22, kolB, label, waarde);
  });
  rechts.forEach(([label, waarde], i) => {
    _veldRij(doc, kol2X, y0 + i * 22, kolB, label, waarde);
  });

  doc.y = y0 + links.length * 22 + 8;
}

// ── Omschrijving van de calamiteit ────────────────────────────────────────────

function _tekenOmschrijving(doc, cal) {
  if (!cal.omschrijving) return;

  _controleerPaginaEinde(doc, 60);
  _sectionHeader(doc, 'OMSCHRIJVING VAN DE CALAMITEIT');

  const startY = doc.y;
  // Achtergrond voor het tekstblok
  doc.rect(MARGE, startY, INHOUD_B, 8).fill(KLEUR_LICHT); // kleine top-padding

  doc.fillColor(KLEUR_TEKST).font('Helvetica').fontSize(9)
     .text(cal.omschrijving, MARGE + 8, startY + 6, {
       width:    INHOUD_B - 16,
       lineGap:  2,
     });

  // Onderste rand
  doc.moveDown(0.4);
  doc.rect(MARGE, doc.y, INHOUD_B, 1).fill(KLEUR_PRIMAIR);
  doc.moveDown(0.3);
}

// ── Opmerkingen / Afwijkingen ─────────────────────────────────────────────────

function _tekenOpmerkingen(doc, cal) {
  if (!cal.opmerkingen) return;

  _controleerPaginaEinde(doc, 60);
  _sectionHeader(doc, 'OPMERKINGEN / AFWIJKINGEN');

  const startY = doc.y;
  doc.rect(MARGE, startY, INHOUD_B, 8).fill('#FFF8E1'); // lichtgele achtergrond

  doc.fillColor(KLEUR_TEKST).font('Helvetica').fontSize(9)
     .text(cal.opmerkingen, MARGE + 8, startY + 6, {
       width:   INHOUD_B - 16,
       lineGap: 2,
     });

  doc.moveDown(0.4);
  doc.rect(MARGE, doc.y, INHOUD_B, 1).fill(KLEUR_PRIMAIR);
  doc.moveDown(0.3);
}

// ── CROW Plaatsingen ──────────────────────────────────────────────────────────

function _tekenCROWPlaatsingen(doc, plaatsingen) {
  if (!plaatsingen || plaatsingen.length === 0) return;

  _controleerPaginaEinde(doc, 60);
  _sectionHeader(doc, 'CROW PLAATSINGEN');

  const cols = [
    { label: 'Object',           x: MARGE,      b: 200 },
    { label: 'HMP Positie (km)', x: MARGE + 200, b: 130 },
    { label: 'Handmatig',        x: MARGE + 330, b: 80  },
  ];

  const headerY = doc.y;
  doc.rect(MARGE, headerY, INHOUD_B, TABEL_RIJ_H).fill(KLEUR_PRIMAIR);
  cols.forEach((col) => {
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8)
       .text(col.label, col.x + 4, headerY + 5, { width: col.b });
  });

  doc.y = headerY + TABEL_RIJ_H;
  plaatsingen.forEach((p, i) => {
    const rijY = doc.y;
    if (i % 2 === 0) doc.rect(MARGE, rijY, INHOUD_B, TABEL_RIJ_H).fill(KLEUR_LICHT);
    doc.fillColor(KLEUR_TEKST).font('Helvetica').fontSize(9);
    doc.text(p.object_naam,                       MARGE + 4,   rijY + 5, { width: 196 });
    doc.text(String(p.hmp_positie),               MARGE + 204, rijY + 5, { width: 126 });
    doc.text(p.is_handmatig ? '✓ Handmatig' : '', MARGE + 334, rijY + 5, { width: 76  });
    doc.y = rijY + TABEL_RIJ_H;
  });

  doc.moveDown(0.5);
}

// ── Ingezet materieel (zonder prijskolommen) ──────────────────────────────────

function _tekenMaterieel(doc, cal) {
  _controleerPaginaEinde(doc, 60);
  _sectionHeader(doc, 'INGEZET MATERIEEL');

  const materieel = cal.materieel || [];
  if (materieel.length === 0) {
    doc.fillColor(KLEUR_GRIJS).fontSize(9)
       .text('Geen materieel geregistreerd.', MARGE, doc.y);
    doc.moveDown(0.5);
    return;
  }

  // Drie kolommen — prijs bewust weggelaten (niet relevant voor buitendienst / klant)
  const cols = [
    { label: 'Materieel', x: MARGE,       b: 280 },
    { label: 'Eenheid',   x: MARGE + 280, b: 100 },
    { label: 'Aantal',    x: MARGE + 380, b: 80  },
  ];

  const headerY = doc.y;
  doc.rect(MARGE, headerY, INHOUD_B, TABEL_RIJ_H).fill(KLEUR_PRIMAIR);
  cols.forEach((c) => {
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8)
       .text(c.label, c.x + 3, headerY + 5, { width: c.b });
  });

  doc.y = headerY + TABEL_RIJ_H;
  materieel.forEach((item, i) => {
    const rijY = doc.y;
    if (i % 2 === 0) doc.rect(MARGE, rijY, INHOUD_B, TABEL_RIJ_H).fill(KLEUR_LICHT);
    doc.fillColor(KLEUR_TEKST).font('Helvetica').fontSize(9);
    doc.text(item.materieel_naam || '—', MARGE + 3,   rijY + 5, { width: 277 });
    doc.text(item.eenheid        || '—', MARGE + 283, rijY + 5, { width: 97  });
    doc.text(String(item.aantal),        MARGE + 383, rijY + 5, { width: 77  });
    doc.y = rijY + TABEL_RIJ_H;
  });

  doc.moveDown(0.5);
}

// ── Restschade & Vervolgactie ─────────────────────────────────────────────────

function _tekenRestschadeEnVervolgactie(doc, cal) {
  const heeftRestschade   = cal.restschade;
  const heeftVervolgactie = cal.vervolgactie;

  if (!heeftRestschade && !heeftVervolgactie) return;

  _controleerPaginaEinde(doc, 60);
  _sectionHeader(doc, 'RESTSCHADE & VERVOLGACTIE');

  // ── Restschade ────────────────────────────────────────────────────────────
  const rsKleur = heeftRestschade ? KLEUR_ROOD    : KLEUR_GROEN;
  const rsTeken = heeftRestschade ? '■ JA'        : '■ NEE';

  doc.rect(MARGE, doc.y, INHOUD_B, 18).fill(KLEUR_LICHT);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(rsKleur)
     .text(rsTeken, MARGE + 6, doc.y + 4, { continued: true });
  doc.fillColor(KLEUR_TEKST).font('Helvetica')
     .text('  Restschade aanwezig');
  doc.y += 18;

  if (heeftRestschade && cal.restschade_omschrijving) {
    const startY = doc.y;
    doc.rect(MARGE, startY, INHOUD_B, 8).fill('#FEF2F2');
    doc.fillColor(KLEUR_GRIJS).font('Helvetica').fontSize(8)
       .text('Omschrijving restschade (tijdspad + inzet):', MARGE + 6, startY + 4);
    doc.y = startY + 14;
    doc.fillColor(KLEUR_TEKST).fontSize(9)
       .text(cal.restschade_omschrijving, MARGE + 6, doc.y, {
         width: INHOUD_B - 12, lineGap: 2,
       });
    doc.moveDown(0.3);
  }

  doc.moveDown(0.3);

  // ── Vervolgactie ──────────────────────────────────────────────────────────
  const vaKleur = heeftVervolgactie ? KLEUR_ROOD : KLEUR_GROEN;
  const vaTeken = heeftVervolgactie ? '■ JA'     : '■ NEE';

  doc.rect(MARGE, doc.y, INHOUD_B, 18).fill(KLEUR_LICHT);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(vaKleur)
     .text(vaTeken, MARGE + 6, doc.y + 4, { continued: true });
  doc.fillColor(KLEUR_TEKST).font('Helvetica')
     .text('  Vervolgactie vereist');
  doc.y += 18;

  if (heeftVervolgactie && cal.vervolgactie_omschrijving) {
    const startY = doc.y;
    doc.rect(MARGE, startY, INHOUD_B, 8).fill('#FEF2F2');
    doc.fillColor(KLEUR_GRIJS).font('Helvetica').fontSize(8)
       .text('Omschrijving vervolgactie:', MARGE + 6, startY + 4);
    doc.y = startY + 14;
    doc.fillColor(KLEUR_TEKST).fontSize(9)
       .text(cal.vervolgactie_omschrijving, MARGE + 6, doc.y, {
         width: INHOUD_B - 12, lineGap: 2,
       });
    doc.moveDown(0.3);
  }

  doc.moveDown(0.4);
}

// ── Veiligheidschecklist (compact, visuele checkboxjes) ───────────────────────

function _tekenVeiligheidschecklist(doc, cal) {
  _controleerPaginaEinde(doc, 120);
  _sectionHeader(doc, 'VEILIGHEIDSCHECKLIST');

  const items = [
    {
      waarde: cal.checklist_pbm,
      label:  "Gebruik van PBM\u2019s (oranje hesjes, veiligheidsschoenen, gehoorbescherming, helm, e.d.).",
    },
    {
      waarde: cal.checklist_fotos_calamiteit,
      label:  'Er zijn foto\u2019s gemaakt waaruit blijkt dat de omschreven calamiteit heeft plaatsgevonden.',
    },
    {
      waarde: cal.checklist_fotos_aanpak,
      label:  'Er zijn foto\u2019s gemaakt waaruit blijkt dat de gevolgde aanpak heeft plaatsgevonden.',
    },
    {
      waarde: cal.checklist_veilig,
      label:  'De weg is weer veilig, (hulp)materialen en afvalstoffen zijn van de weg af.',
    },
    {
      waarde: cal.checklist_stortbon,
      label:  'Indien van toepassing is er een stortbon ontvangen van afgevoerde materialen.',
    },
  ];

  const RIJ_H    = 18;  // compacte rijhoogte
  const BOX_SIZE = 9;   // vierkantje grootte
  const TEKST_X  = MARGE + 16;

  items.forEach((item, i) => {
    const isOk   = Boolean(item.waarde);
    const rijY   = doc.y;
    const achtergrond = i % 2 === 0 ? KLEUR_LICHT : '#FFFFFF';

    doc.rect(MARGE, rijY, INHOUD_B, RIJ_H).fill(achtergrond);

    // Visueel checkboxje (getekend vierkantje met vinkje of kruisje)
    const boxX = MARGE + 4;
    const boxY = rijY + (RIJ_H - BOX_SIZE) / 2;

    // Rand van het vakje
    doc.rect(boxX, boxY, BOX_SIZE, BOX_SIZE)
       .lineWidth(0.8)
       .strokeColor(isOk ? KLEUR_GROEN : KLEUR_ROOD)
       .fillAndStroke(isOk ? '#DCFCE7' : '#FEE2E2', isOk ? KLEUR_GROEN : KLEUR_ROOD);

    // Vinkje of kruisje in het vakje
    doc.font('Helvetica-Bold')
       .fontSize(7)
       .fillColor(isOk ? KLEUR_GROEN : KLEUR_ROOD)
       .text(isOk ? '✓' : '✗', boxX + 1.5, boxY + 0.5, { width: BOX_SIZE - 3 });

    // Tekst naast het vakje
    doc.font('Helvetica')
       .fontSize(7.5)
       .fillColor(KLEUR_TEKST)
       .text(item.label, TEKST_X, rijY + (RIJ_H - 8) / 2, {
         width:    INHOUD_B - (TEKST_X - MARGE) - 4,
         ellipsis: true,
       });

    doc.y = rijY + RIJ_H;
  });

  doc.moveDown(0.4);
}

// ── Foto's (A5, 2 per pagina) ─────────────────────────────────────────────────

function _tekenFotos(doc, fotos) {
  doc.addPage();
  _sectionHeader(doc, `FOTO'S (${fotos.length} stuks)`);

  const uploadsMap = path.join(process.cwd(), process.env.UPLOAD_MAP || 'uploads');
  let positieOpPagina = 0;

  for (let i = 0; i < fotos.length; i++) {
    const foto        = fotos[i];
    const bestandsPad = path.join(uploadsMap, foto.bestandsnaam);

    if (positieOpPagina === 0 && i > 0) {
      doc.addPage();
    }

    const fotoY = positieOpPagina === 0
      ? MARGE + 30
      : MARGE + FOTO_HOOGTE + MARGE + 30;

    doc.font('Helvetica').fontSize(7).fillColor(KLEUR_GRIJS)
       .text(`Foto ${i + 1}: ${foto.bestandsnaam}`, MARGE, fotoY - 12);

    if (fs.existsSync(bestandsPad)) {
      try {
        doc.image(bestandsPad, MARGE, fotoY, {
          width:  INHOUD_B,
          height: FOTO_HOOGTE - 20,
          fit:    [INHOUD_B, FOTO_HOOGTE - 20],
          align:  'center',
          valign: 'center',
        });
      } catch {
        _tekenFotoPlaceholder(doc, MARGE, fotoY, INHOUD_B, FOTO_HOOGTE - 20, foto.bestandsnaam);
      }
    } else {
      _tekenFotoPlaceholder(doc, MARGE, fotoY, INHOUD_B, FOTO_HOOGTE - 20, foto.bestandsnaam);
    }

    positieOpPagina = positieOpPagina === 0 ? 1 : 0;
  }
}

// ── Hulpfuncties ──────────────────────────────────────────────────────────────

function _sectionHeader(doc, titel) {
  const y = doc.y;
  doc.rect(MARGE, y, INHOUD_B, 18).fill(KLEUR_PRIMAIR);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9)
     .text(titel, MARGE + 8, y + 4, { width: INHOUD_B - 16 });
  doc.y = y + 22;
}

function _veldRij(doc, x, y, breedte, label, waarde) {
  doc.font('Helvetica').fontSize(7.5).fillColor(KLEUR_GRIJS)
     .text(label, x, y, { width: breedte });
  doc.font('Helvetica').fontSize(9).fillColor(KLEUR_TEKST)
     .text(String(waarde ?? '—'), x, y + 9, { width: breedte });
}

function _tekenFotoPlaceholder(doc, x, y, breedte, hoogte, naam) {
  doc.rect(x, y, breedte, hoogte).fill('#E5E7EB');
  doc.fillColor(KLEUR_GRIJS).font('Helvetica').fontSize(10)
     .text(`[Foto niet beschikbaar: ${naam}]`, x, y + hoogte / 2 - 10, {
       width: breedte, align: 'center',
     });
}

function _controleerPaginaEinde(doc, minimaleRuimte) {
  if (doc.y + minimaleRuimte > PAGINA_H - MARGE) {
    doc.addPage();
  }
}

function _formatteerDatum(datum) {
  if (!datum) return '—';
  return new Date(datum).toLocaleString('nl-NL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

module.exports = { genereerCalamiteitPDF };
