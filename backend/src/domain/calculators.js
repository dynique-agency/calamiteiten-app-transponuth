'use strict';

/**
 * calculators.js — Domein-hulpfuncties voor de Calamiteiten Applicatie
 *
 * Bevat berekeningen voor HMP-formattering, uren, facturatie en snapshotting.
 * Sommige functies bevatten bewust bekende beperkingen (technical debt) die
 * zichtbaar worden in de unit-tests (zie tests/calculators.test.js).
 */

/**
 * Formatteert een HMP-waarde naar de Nederlandse notatie met komma.
 * Verwijdert spaties, vervangt punt door komma.
 * Geeft NaN terug als de waarde letters bevat.
 *
 * @param {string} val
 * @returns {string|NaN}
 */
function formatHmp(val) {
  const zonder_spaties = String(val).replace(/\s/g, '');
  if (/[a-zA-Z]/.test(zonder_spaties)) return NaN;
  return zonder_spaties.replace('.', ',');
}

/**
 * Berekent de HMP van het startpunt van de afzetting op basis van de
 * incidentpositie, rijrichting en offset in meters.
 *
 * Technische kanttekening: deze functie gebruikt geen .toFixed() afronding,
 * waardoor JavaScript floating-point afrondingsfouten zichtbaar kunnen zijn
 * (bijv. 100.1 - 0.6 = 99.50000000000001 i.p.v. 99.5).
 *
 * @param {number} hmp       - HMP van het incident (km)
 * @param {string} richting  - 'Oplopend' of 'Aflopend'
 * @param {number} offset    - Afstand in meters (negatief = achter incident)
 * @returns {number}
 */
function berekenStartHmp(hmp, richting, offset) {
  if (richting === 'Oplopend') {
    return hmp + (offset / 1000);
  }
  return hmp - (offset / 1000);
}

/**
 * Berekent het aantal te factureren uren op basis van start- en eindtijd (HH:mm).
 * Past de Strukton 4-uurs minimumregel toe en rondt af naar boven per kwartier.
 *
 * Technische kanttekening: de functie bevat geen datum-overgangslogica.
 * Bij nachtdiensten die middernacht overschrijden (bijv. 23:00 t/m 02:00)
 * levert eind - start een negatief getal op (-21 uur), wat de berekening
 * onjuist maakt. Dit is een bekende technische schuld.
 *
 * @param {string} start - Starttijd als "HH:mm"
 * @param {string} eind  - Eindtijd als "HH:mm"
 * @returns {number}
 */
function berekenUren(start, eind) {
  const [startUur, startMin] = start.split(':').map(Number);
  const [eindUur,  eindMin]  = eind.split(':').map(Number);

  const startDecimaal = startUur + startMin / 60;
  const eindDecimaal  = eindUur  + eindMin  / 60;

  let totaal = eindDecimaal - startDecimaal;

  if (totaal < 4) totaal = 4;

  return Math.ceil(totaal * 4) / 4;
}

/**
 * Controleert of een waarde aanwezig is.
 * Geeft een leesbare melding terug bij lege of ontbrekende waarden.
 *
 * @param {*} val
 * @returns {string|*}
 */
function nullCheck(val) {
  if (val === undefined) return 'Niet ingevuld';
  if (Array.isArray(val) && val.length === 0) return 'Geen';
  return val;
}

/**
 * Bepaalt of een materieel-item facturabel is op basis van de naam.
 * Extern Materieel wordt buiten de factuur gehouden.
 *
 * @param {string} naam
 * @returns {boolean}
 */
function isFacturabel(naam) {
  return naam !== 'Extern Materieel';
}

/**
 * Voegt een prijssnapshot toe aan een materieel-item.
 * De snapshot wordt gemaakt op het moment van opslaan zodat toekomstige
 * tariefwijzigingen de historische data niet beïnvloeden.
 *
 * @param {object} item     - Het materieel-item
 * @param {object} prijsObj - Object met een `prijs` eigenschap
 * @returns {object}
 */
function mergePrijs(item, prijsObj) {
  return { ...item, snapshot_prijs: prijsObj.prijs };
}

module.exports = {
  formatHmp,
  berekenStartHmp,
  berekenUren,
  nullCheck,
  isFacturabel,
  mergePrijs,
};
