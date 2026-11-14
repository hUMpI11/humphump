import type { CheckField, Field, NumberField, Section, SelectField, TableColumn, TextField, Template } from './types';

// Alle Vorlagen sind Arbeitshilfen, keine normkonformen Prüfprotokolle. Soll- und Grenzwerte sind Eingabefelder.
// Neue Vorlage = neuer Eintrag hier; Engine und Views kennen keine einzelne Vorlage.

const text = (id: string, label: string, hint?: string): TextField => ({ id, label, type: 'text', ...(hint ? { hint } : {}) });
const longtext = (id: string, label: string, hint?: string): TextField => ({ id, label, type: 'longtext', ...(hint ? { hint } : {}) });
const datum = (id: string, label: string): TextField => ({ id, label, type: 'date' });
const zahl = (id: string, label: string, unit?: string, hint?: string): NumberField => ({ id, label, type: 'number', ...(unit ? { unit } : {}), ...(hint ? { hint } : {}) });
const auswahl = (id: string, label: string, options: string[]): SelectField => ({ id, label, type: 'select', options });
const pruef = (id: string, label: string, hint?: string): CheckField => ({ id, label, type: 'check', ...(hint ? { hint } : {}) });
const abschnitt = (title: string, fields: Field[]): Section => ({ title, fields });
const spalteText = (id: string, label: string): TableColumn => ({ id, label, type: 'text' });
const spalteZahl = (id: string, label: string, unit?: string, extra: Partial<TableColumn> = {}): TableColumn => ({ id, label, type: 'number', ...(unit ? { unit } : {}), ...extra });

const ARBEITSHILFE = 'Arbeitshilfe – ersetzt nicht das vorgeschriebene Prüfprotokoll.';

export const TEMPLATES: Template[] = [
  // ---------- Allgemein ----------
  {
    id: 'aufmass-flaeche',
    version: 1,
    name: 'Aufmaß Fläche',
    gewerke: ['*'],
    beschreibung: 'Flächen aus Länge × Breite mit Abzügen. Auch für Wände: Länge × Höhe, Fenster und Türen als Abzug in m².',
    sections: [
      abschnitt('Positionen', [
        {
          id: 'positionen',
          label: 'Positionen',
          type: 'table',
          rowLabel: 'Position',
          columns: [
            spalteText('bezeichnung', 'Bezeichnung'),
            spalteZahl('l', 'Länge', 'm'),
            spalteZahl('b', 'Breite / Höhe', 'm'),
            spalteZahl('anzahl', 'Anzahl', undefined, { default: 1 }),
            spalteZahl('abzug', 'Abzug', 'm²', { default: 0 }),
            spalteZahl('flaeche', 'Fläche', 'm²', { formula: 'l * b * anzahl - abzug' }),
          ],
          summary: [{ column: 'flaeche', label: 'Gesamtfläche', unit: 'm²' }],
        },
      ]),
      abschnitt('Bemerkung', [longtext('bemerkung', 'Bemerkung')]),
    ],
  },
  {
    id: 'aufmass-laenge-volumen',
    version: 1,
    name: 'Aufmaß Länge / Volumen',
    gewerke: ['*'],
    beschreibung: 'Längen (Leitungen, Rohre, Leisten, Kanäle) und Volumen (Aushub, Beton, Estrich) in zwei Tabellen. Nicht Benötigtes leer lassen.',
    sections: [
      abschnitt('Längen', [
        {
          id: 'laengen',
          label: 'Längen',
          type: 'table',
          rowLabel: 'Länge',
          columns: [
            spalteText('bezeichnung', 'Bezeichnung'),
            spalteZahl('laenge', 'Länge', 'm'),
            spalteZahl('anzahl', 'Anzahl', undefined, { default: 1 }),
            spalteZahl('gesamt', 'Gesamtlänge', 'm', { formula: 'laenge * anzahl' }),
          ],
          summary: [{ column: 'gesamt', label: 'Gesamtlänge', unit: 'm' }],
        },
      ]),
      abschnitt('Volumen', [
        {
          id: 'volumen',
          label: 'Volumen',
          type: 'table',
          rowLabel: 'Volumen',
          columns: [
            spalteText('bezeichnung', 'Bezeichnung'),
            spalteZahl('l', 'Länge', 'm'),
            spalteZahl('b', 'Breite', 'm'),
            spalteZahl('h', 'Höhe / Tiefe', 'm'),
            spalteZahl('anzahl', 'Anzahl', undefined, { default: 1 }),
            spalteZahl('abzug', 'Abzug', 'm³', { default: 0 }),
            spalteZahl('vol', 'Volumen', 'm³', { formula: 'l * b * h * anzahl - abzug', digits: 3 }),
          ],
          summary: [{ column: 'vol', label: 'Gesamtvolumen', unit: 'm³' }],
        },
      ]),
    ],
  },
  {
    id: 'stueckliste',
    version: 1,
    name: 'Stückliste',
    gewerke: ['*'],
    beschreibung: 'Verbautes oder benötigtes Material mit Menge und Einheit.',
    sections: [
      abschnitt('Material', [
        {
          id: 'positionen',
          label: 'Positionen',
          type: 'table',
          rowLabel: 'Position',
          columns: [
            spalteText('bezeichnung', 'Bezeichnung'),
            spalteZahl('menge', 'Menge'),
            { id: 'einheit', label: 'Einheit', type: 'select', options: ['Stk', 'm', 'm²', 'm³', 'kg', 'l', 'Pkg', 'Satz', 'Rolle', 'Sack', 'psch'] },
            spalteText('bemerkung', 'Bemerkung'),
          ],
        },
      ]),
    ],
  },
  {
    id: 'abnahme',
    version: 1,
    name: 'Abnahme mit Mängelliste',
    gewerke: ['*'],
    beschreibung: 'Übergabe an den Kunden: Prüfpunkte, Mängel und Restarbeiten, Ergebnis. Unterschrift über den Bericht.',
    sections: [
      abschnitt('Allgemein', [
        datum('datum', 'Datum der Abnahme'),
        text('leistung', 'Abgenommene Leistung'),
        text('anwesend', 'Anwesend'),
      ]),
      abschnitt('Prüfpunkte', [
        pruef('fertig', 'Leistung vollständig ausgeführt'),
        pruef('funktion', 'Funktion geprüft'),
        pruef('sauber', 'Baustelle gesäubert, Abfall entsorgt'),
        pruef('einweisung', 'Kunde eingewiesen'),
        pruef('unterlagen', 'Unterlagen übergeben'),
      ]),
      abschnitt('Mängel und Restarbeiten', [
        {
          id: 'maengel',
          label: 'Mängel / Restarbeiten',
          type: 'table',
          rowLabel: 'Mangel',
          columns: [
            spalteText('beschreibung', 'Beschreibung'),
            spalteText('ort', 'Ort / Raum'),
            spalteText('frist', 'Frist bis'),
            { id: 'status', label: 'Status', type: 'select', options: ['offen', 'erledigt'] },
          ],
        },
      ]),
      abschnitt('Ergebnis', [
        auswahl('ergebnis', 'Ergebnis', ['Abnahme ohne Mängel', 'Abnahme mit Vorbehalt', 'Nicht abgenommen']),
        longtext('bemerkung', 'Bemerkung'),
      ]),
    ],
  },
  {
    id: 'bautagesbericht',
    version: 2,
    name: 'Bautagesbericht',
    gewerke: ['*'],
    beschreibung: 'Kurzer Tagesbericht: Wetter, Personal und Stunden, Arbeiten, Behinderungen. Die Stunden stehen nur im Bericht und werden nicht in den Stunden-Reiter übernommen.',
    sections: [
      abschnitt('Tag', [
        datum('datum', 'Datum'),
        auswahl('wetter', 'Wetter', ['trocken', 'Regen', 'Schnee / Frost', 'Wind', 'wechselhaft']),
        zahl('temperatur', 'Temperatur', '°C'),
        zahl('personal', 'Personal auf der Baustelle', 'Pers.'),
      ]),
      abschnitt('Personal und Stunden', [
        {
          id: 'personalStunden',
          label: 'Personal und Stunden',
          type: 'table',
          rowLabel: 'Person',
          columns: [spalteText('name', 'Name'), spalteText('taetigkeit', 'Tätigkeit'), spalteZahl('stunden', 'Stunden', 'h')],
          summary: [{ column: 'stunden', label: 'Stunden gesamt', unit: 'h' }],
        },
      ]),
      abschnitt('Bericht', [
        longtext('arbeiten', 'Ausgeführte Arbeiten'),
        longtext('behinderungen', 'Behinderungen / Wartezeiten'),
        longtext('lieferungen', 'Lieferungen / Besucher'),
        longtext('vorkommnisse', 'Besondere Vorkommnisse'),
      ]),
    ],
  },

  // ---------- MSR ----------
  {
    id: 'msr-datenpunkte',
    version: 1,
    name: 'Datenpunktprüfung',
    gewerke: ['msr'],
    beschreibung: 'Datenpunkte je Adresse durchgehen und als i. O. oder Mangel bewerten. Arbeitshilfe zur Dokumentation.',
    sections: [
      abschnitt('Anlage', [
        text('anlage', 'Anlage / Schrank'),
        datum('datum', 'Datum'),
        text('geraet', 'Prüfgerät / Simulator', 'z. B. Kalibrator, Widerstandsdekade'),
      ]),
      abschnitt('Datenpunkte', [
        {
          id: 'datenpunkte',
          label: 'Datenpunkte',
          type: 'table',
          rowLabel: 'Datenpunkt',
          columns: [
            spalteText('adresse', 'Adresse'),
            spalteText('bezeichnung', 'Bezeichnung'),
            { id: 'typ', label: 'Typ', type: 'select', options: ['AI', 'AO', 'DI', 'DO', 'Sonstige'] },
            { id: 'pruefung', label: 'Prüfung', type: 'check' },
            spalteText('bemerkung', 'Bemerkung'),
          ],
        },
      ]),
      abschnitt('Bemerkung', [longtext('bemerkung', 'Bemerkung')]),
    ],
  },
  {
    id: 'msr-inbetriebnahme',
    version: 1,
    name: 'Inbetriebnahme Regelung',
    gewerke: ['msr'],
    beschreibung: 'Checkliste für die Inbetriebnahme einer Regelung mit Parametern. Arbeitshilfe, kein normiertes Prüfprotokoll.',
    sections: [
      abschnitt('Anlage', [
        text('anlage', 'Anlage / Regler'),
        datum('datum', 'Datum'),
        text('software', 'Softwarestand / Programmname'),
      ]),
      abschnitt('Vorprüfung', [
        pruef('spannung', 'Spannungsversorgung und Sicherungen'),
        pruef('verdrahtung', 'Verdrahtung gesichtet'),
        pruef('fuehler', 'Fühler montiert und angeschlossen'),
        pruef('antriebe', 'Stellantriebe: Laufrichtung und Hub'),
        pruef('handebene', 'Hand-/Notbetrieb funktioniert'),
      ]),
      abschnitt('Funktionstest', [
        pruef('betriebsarten', 'Betriebsarten umgeschaltet'),
        pruef('frost', 'Frostschutz / Sicherheitsketten'),
        pruef('regelung', 'Regelverhalten stabil'),
        pruef('zeitprogramm', 'Zeitprogramm und Sollwerte'),
        pruef('stoerung', 'Störmeldungen kommen an'),
        pruef('wiederkehr', 'Verhalten bei Spannungswiederkehr'),
      ]),
      abschnitt('Parameter', [
        {
          id: 'parameter',
          label: 'Wichtige Parameter',
          type: 'table',
          rowLabel: 'Parameter',
          columns: [spalteText('name', 'Parameter'), spalteText('wert', 'Wert'), spalteText('einheit', 'Einheit')],
          presetRows: [{ name: 'Sollwert' }, { name: 'P-Anteil' }, { name: 'I-Zeit' }],
        },
      ]),
      abschnitt('Abschluss', [pruef('einweisung', 'Betreiber eingewiesen'), longtext('bemerkung', 'Bemerkung / offene Punkte')]),
    ],
  },
  {
    id: 'msr-fuehlerabgleich',
    version: 1,
    name: 'Fühlerabgleich',
    gewerke: ['msr'],
    beschreibung: 'Anzeige am System gegen Referenzmessung. Abweichung wird berechnet; ob sie zulässig ist, entscheidest du.',
    sections: [
      abschnitt('Messung', [
        text('anlage', 'Anlage'),
        text('referenz', 'Referenzgerät', 'Gerät und ggf. Kalibrierdatum'),
        zahl('toleranz', 'Zulässige Abweichung', undefined, 'Eigener Richtwert, z. B. aus Vorgabe des Auftraggebers'),
      ]),
      abschnitt('Messstellen', [
        {
          id: 'messstellen',
          label: 'Messstellen',
          type: 'table',
          rowLabel: 'Messstelle',
          columns: [
            spalteText('messstelle', 'Messstelle'),
            spalteZahl('referenz', 'Referenz'),
            spalteZahl('anzeige', 'Anzeige System'),
            spalteZahl('abweichung', 'Abweichung', undefined, { formula: 'anzeige - referenz', digits: 2 }),
            spalteText('einheit', 'Einheit'),
          ],
        },
      ]),
    ],
  },

  // ---------- Heizung ----------
  {
    id: 'heizung-druckprobe',
    version: 1,
    name: 'Druckprobe',
    gewerke: ['heizung'],
    beschreibung: `Druckverlauf je Kreis mit berechnetem Druckabfall. Prüfdruck und Dauer trägst du nach Vorgabe ein. ${ARBEITSHILFE}`,
    sections: [
      abschnitt('Prüfung', [
        text('anlage', 'Anlage / Leitungsabschnitt'),
        datum('datum', 'Datum'),
        auswahl('medium', 'Prüfmedium', ['Wasser', 'Luft', 'Inertgas']),
      ]),
      abschnitt('Messwerte', [
        {
          id: 'messwerte',
          label: 'Prüfkreise',
          type: 'table',
          rowLabel: 'Prüfkreis',
          columns: [
            spalteText('kreis', 'Kreis / Abschnitt'),
            spalteZahl('pruefdruck', 'Prüfdruck', 'bar'),
            spalteZahl('dauer', 'Prüfdauer', 'min'),
            spalteZahl('start', 'Druck Beginn', 'bar'),
            spalteZahl('ende', 'Druck Ende', 'bar'),
            spalteZahl('abfall', 'Druckabfall', 'bar', { formula: 'start - ende', digits: 2 }),
          ],
          presetRows: [{ kreis: 'Gesamtanlage' }],
        },
      ]),
      abschnitt('Ergebnis', [pruef('ergebnis', 'Dichtheit festgestellt'), longtext('bemerkung', 'Bemerkung')]),
    ],
  },
  {
    id: 'heizung-inbetriebnahme',
    version: 1,
    name: 'Inbetriebnahme / Wartung Heizung',
    gewerke: ['heizung'],
    beschreibung: 'Kurze Checkliste mit Betriebswerten für Inbetriebnahme oder Wartung. Arbeitshilfe, Herstellervorgaben gehen vor.',
    sections: [
      abschnitt('Anlage', [
        text('anlage', 'Anlage / Wärmeerzeuger'),
        datum('datum', 'Datum'),
        auswahl('anlass', 'Anlass', ['Inbetriebnahme', 'Wartung', 'Störung']),
      ]),
      abschnitt('Prüfpunkte', [
        pruef('dichtheit', 'Sichtprüfung auf Undichtigkeiten'),
        pruef('entlueftet', 'Anlage entlüftet'),
        pruef('sicherheit', 'Sicherheitsventil / Sicherheitseinrichtungen'),
        pruef('ausdehnung', 'Ausdehnungsgefäß / Vordruck'),
        pruef('pumpe', 'Umwälzpumpe läuft'),
        pruef('regelung', 'Regelung und Heizkurve'),
        pruef('abgas', 'Abgasführung / Verbrennung gesichtet'),
      ]),
      abschnitt('Betriebswerte', [
        zahl('druck', 'Anlagendruck', 'bar'),
        zahl('vorlauf', 'Vorlauftemperatur', '°C'),
        zahl('ruecklauf', 'Rücklauftemperatur', '°C'),
      ]),
      abschnitt('Abschluss', [longtext('bemerkung', 'Bemerkung / Arbeiten')]),
    ],
  },
  {
    id: 'heizung-abgleich',
    version: 1,
    name: 'Hydraulischer Abgleich',
    gewerke: ['heizung'],
    beschreibung: 'Voreinstellungen je Heizkörper oder Strang festhalten: Soll aus der Berechnung, Ist wie eingestellt.',
    sections: [
      abschnitt('Anlage', [text('anlage', 'Anlage / Gebäude'), datum('datum', 'Datum'), text('berechnung', 'Berechnung / Quelle der Sollwerte')]),
      abschnitt('Einstellwerte', [
        {
          id: 'einstellungen',
          label: 'Heizkörper / Stränge',
          type: 'table',
          rowLabel: 'Heizkörper',
          columns: [
            spalteText('raum', 'Raum / Strang'),
            spalteText('ventil', 'Ventil'),
            spalteZahl('soll', 'Voreinstellung Soll'),
            spalteZahl('ist', 'Voreinstellung Ist'),
            spalteZahl('abweichung', 'Differenz', undefined, { formula: 'ist - soll', digits: 1 }),
          ],
        },
      ]),
      abschnitt('Pumpe', [text('pumpe', 'Pumpeneinstellung'), longtext('bemerkung', 'Bemerkung')]),
    ],
  },

  // ---------- Lüftung ----------
  {
    id: 'lueftung-luftmengen',
    version: 1,
    name: 'Luftmengenmessung',
    gewerke: ['lueftung'],
    beschreibung: 'Soll- und Ist-Volumenstrom je Auslass, Abweichung in Prozent und Summen. Sollwerte aus der Planung.',
    sections: [
      abschnitt('Anlage', [
        text('anlage', 'Anlage / Gerät'),
        datum('datum', 'Datum'),
        text('messgeraet', 'Messgerät'),
        zahl('toleranz', 'Zulässige Abweichung', '%', 'Eigener Richtwert, nicht vorgegeben'),
      ]),
      abschnitt('Auslässe', [
        {
          id: 'auslaesse',
          label: 'Luftdurchlässe',
          type: 'table',
          rowLabel: 'Auslass',
          columns: [
            spalteText('auslass', 'Auslass'),
            spalteText('raum', 'Raum'),
            spalteZahl('soll', 'Soll', 'm³/h'),
            spalteZahl('ist', 'Ist', 'm³/h'),
            spalteZahl('abw', 'Abweichung', '%', { formula: '(ist - soll) / soll * 100', digits: 1 }),
          ],
          summary: [
            { column: 'soll', label: 'Summe Soll', unit: 'm³/h' },
            { column: 'ist', label: 'Summe Ist', unit: 'm³/h' },
          ],
        },
      ]),
      abschnitt('Bemerkung', [longtext('bemerkung', 'Bemerkung')]),
    ],
  },
  {
    id: 'lueftung-wartung',
    version: 1,
    name: 'Wartung / Filterwechsel Lüftung',
    gewerke: ['lueftung'],
    beschreibung: 'Wartungsrunde am Lüftungsgerät mit Filterwechsel. Arbeitshilfe, Herstellervorgaben gehen vor.',
    sections: [
      abschnitt('Anlage', [text('anlage', 'Anlage / Gerät'), datum('datum', 'Datum')]),
      abschnitt('Prüfpunkte', [
        pruef('ventilator', 'Ventilator und Antrieb'),
        pruef('klappen', 'Klappen und Antriebe'),
        pruef('waermetauscher', 'Wärmetauscher'),
        pruef('kondensat', 'Kondensatablauf'),
        pruef('sauberkeit', 'Gerät innen sauber'),
        pruef('dichtungen', 'Dichtungen und Türen'),
      ]),
      abschnitt('Filter', [
        {
          id: 'filter',
          label: 'Filter',
          type: 'table',
          rowLabel: 'Filter',
          columns: [
            spalteText('stufe', 'Stufe'),
            spalteText('typ', 'Typ / Klasse'),
            spalteZahl('dp', 'Differenzdruck', 'Pa'),
            { id: 'gewechselt', label: 'Gewechselt', type: 'check' },
          ],
          presetRows: [{ stufe: 'Zuluft' }, { stufe: 'Abluft' }],
        },
      ]),
      abschnitt('Abschluss', [longtext('bemerkung', 'Bemerkung')]),
    ],
  },

  // ---------- Sanitär ----------
  {
    id: 'sanitaer-dichtheit',
    version: 1,
    name: 'Dichtheitsprüfung und Übergabe',
    gewerke: ['sanitaer'],
    beschreibung: `Druckverlauf und Übergabe-Checkliste für Sanitärinstallationen. ${ARBEITSHILFE}`,
    sections: [
      abschnitt('Prüfung', [
        text('anlage', 'Leitung / Abschnitt'),
        datum('datum', 'Datum'),
        auswahl('medium', 'Prüfmedium', ['Wasser', 'Luft', 'Inertgas']),
      ]),
      abschnitt('Messwerte', [
        {
          id: 'messwerte',
          label: 'Prüfabschnitte',
          type: 'table',
          rowLabel: 'Abschnitt',
          columns: [
            spalteText('abschnitt', 'Abschnitt'),
            spalteZahl('pruefdruck', 'Prüfdruck', 'bar'),
            spalteZahl('dauer', 'Dauer', 'min'),
            spalteZahl('start', 'Druck Beginn', 'bar'),
            spalteZahl('ende', 'Druck Ende', 'bar'),
            spalteZahl('abfall', 'Druckabfall', 'bar', { formula: 'start - ende', digits: 2 }),
          ],
        },
      ]),
      abschnitt('Übergabe', [
        pruef('dicht', 'Keine Undichtigkeit sichtbar'),
        pruef('armaturen', 'Armaturen und Eckventile funktionieren'),
        pruef('ablauf', 'Abläufe frei, Siphons gefüllt'),
        pruef('spuelung', 'Leitungen gespült'),
        pruef('einweisung', 'Kunde eingewiesen'),
        longtext('bemerkung', 'Bemerkung'),
      ]),
    ],
  },

  // ---------- Elektro ----------
  {
    id: 'elektro-stromkreise',
    version: 1,
    name: 'Prüf-Checkliste Stromkreise',
    gewerke: ['elektro'],
    beschreibung: `Messwerte und Sichtprüfung je Stromkreis zum Festhalten. ${ARBEITSHILFE}`,
    sections: [
      abschnitt('Anlage', [text('anlage', 'Anlage / Verteiler'), datum('datum', 'Datum'), text('messgeraet', 'Messgerät')]),
      abschnitt('Stromkreise', [
        {
          id: 'stromkreise',
          label: 'Stromkreise',
          type: 'table',
          rowLabel: 'Stromkreis',
          columns: [
            spalteText('kreis', 'Kreis'),
            spalteText('bezeichnung', 'Bezeichnung'),
            spalteText('schutz', 'Schutzeinrichtung'),
            spalteText('leitung', 'Leitung'),
            spalteZahl('riso', 'Isolationswiderstand', 'MΩ'),
            spalteZahl('zs', 'Schleifenimpedanz', 'Ω'),
            { id: 'pruefung', label: 'Prüfung', type: 'check' },
          ],
        },
      ]),
      abschnitt('Bemerkung', [longtext('bemerkung', 'Bemerkung / Mängel')]),
    ],
  },

  // ---------- Schreiner ----------
  {
    id: 'schreiner-tueren-fenster',
    version: 1,
    name: 'Aufmaß Türen / Fenster',
    gewerke: ['schreiner'],
    beschreibung: 'Maße in mm je Element, Fläche und Stückzahl werden berechnet.',
    sections: [
      abschnitt('Elemente', [
        {
          id: 'elemente',
          label: 'Türen / Fenster',
          type: 'table',
          rowLabel: 'Element',
          columns: [
            spalteText('pos', 'Pos. / Raum'),
            { id: 'typ', label: 'Typ', type: 'select', options: ['Tür', 'Fenster', 'Haustür', 'Sonstiges'] },
            spalteZahl('breite', 'Breite', 'mm'),
            spalteZahl('hoehe', 'Höhe', 'mm'),
            spalteZahl('anzahl', 'Anzahl', undefined, { default: 1 }),
            { id: 'anschlag', label: 'Anschlag', type: 'select', options: ['links', 'rechts', 'ohne'] },
            spalteZahl('flaeche', 'Fläche', 'm²', { formula: 'breite * hoehe * anzahl / 1000000' }),
          ],
          summary: [
            { column: 'anzahl', label: 'Stückzahl' },
            { column: 'flaeche', label: 'Gesamtfläche', unit: 'm²' },
          ],
        },
      ]),
      abschnitt('Bemerkung', [longtext('bemerkung', 'Bemerkung (Wandstärke, Material, Beschläge)')]),
    ],
  },
];

export function templateById(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

/** Vorlagen, die zu den Gewerken einer Baustelle passen (inkl. allgemeiner '*'), passende zuerst. */
export function templatesFor(gewerke: string[]): Template[] {
  const passt = (t: Template) => t.gewerke.some((g) => gewerke.includes(g));
  return [...TEMPLATES.filter(passt), ...TEMPLATES.filter((t) => !passt(t) && t.gewerke.includes('*'))];
}
