/**
 * Gewerke mit Vorschlagslisten. Das sind bewusst nur Eingabehilfen (Autovervollständigung),
 * keine Pflichtkataloge – jede Firma arbeitet anders. Erweiterbar durch Einträge hier.
 */
export interface Gewerk {
  id: string;
  name: string;
  taetigkeiten: string[];
  material: [bezeichnung: string, einheit: string][];
}

export const EINHEITEN = ['Stk', 'm', 'm²', 'm³', 'kg', 'l', 'Pkg', 'Satz', 'Rolle', 'Sack', 'h', 'psch'];

export const GEWERKE: Gewerk[] = [
  {
    id: 'msr',
    name: 'MSR',
    taetigkeiten: [
      'Schaltschrank montiert', 'Schaltschrank verdrahtet', 'Feldgeräte montiert', 'Fühler montiert und angeschlossen',
      'Kabel gezogen', 'Datenpunktprüfung', 'Inbetriebnahme', 'Programmierung / Parametrierung', 'Störungssuche',
      'Einweisung Betreiber', 'Dokumentation',
    ],
    material: [
      ['Temperaturfühler PT1000', 'Stk'], ['Tauchhülse', 'Stk'], ['Kanalfühler', 'Stk'], ['Außenfühler', 'Stk'],
      ['Druckaufnehmer', 'Stk'], ['Differenzdruckschalter', 'Stk'], ['Stellantrieb', 'Stk'], ['Klappenantrieb', 'Stk'],
      ['Frostschutzwächter', 'Stk'], ['Koppelrelais', 'Stk'], ['Reihenklemme', 'Stk'], ['Steuerleitung JY(St)Y 2x2x0,8', 'm'],
      ['Leitung NYM-J 3x1,5', 'm'], ['Kabelkanal', 'm'], ['Aderendhülsen', 'Pkg'],
    ],
  },
  {
    id: 'heizung',
    name: 'Heizung',
    taetigkeiten: [
      'Rohrleitung verlegt', 'Heizkörper montiert', 'Kessel / Wärmeerzeuger montiert', 'Pumpe getauscht', 'Armaturen montiert',
      'Druckprobe', 'Anlage gespült und befüllt', 'Hydraulischer Abgleich', 'Dämmung', 'Wartung', 'Inbetriebnahme', 'Störungssuche',
    ],
    material: [
      ['Kupferrohr 15 mm', 'm'], ['Kupferrohr 22 mm', 'm'], ['Stahlrohr', 'm'], ['Verbundrohr 16 mm', 'm'], ['Pressfitting', 'Stk'],
      ['Kugelhahn', 'Stk'], ['Thermostatventil', 'Stk'], ['Heizkörper', 'Stk'], ['Umwälzpumpe', 'Stk'], ['Ausdehnungsgefäß', 'Stk'],
      ['Sicherheitsventil', 'Stk'], ['Rohrisolierung', 'm'], ['Rohrschelle', 'Stk'], ['Hanf / Dichtmittel', 'Pkg'],
    ],
  },
  {
    id: 'lueftung',
    name: 'Lüftung',
    taetigkeiten: [
      'Kanal montiert', 'Wickelfalzrohr montiert', 'Lüftungsgerät aufgestellt', 'Auslässe montiert', 'Brandschutzklappe eingebaut',
      'Filterwechsel', 'Luftmengen eingemessen', 'Dämmung', 'Wartung', 'Inbetriebnahme', 'Störungssuche',
    ],
    material: [
      ['Wickelfalzrohr DN100', 'm'], ['Wickelfalzrohr DN125', 'm'], ['Wickelfalzrohr DN160', 'm'], ['Bogen 90°', 'Stk'],
      ['T-Stück', 'Stk'], ['Reduzierung', 'Stk'], ['Flexrohr', 'm'], ['Luftkanal', 'm²'], ['Tellerventil', 'Stk'],
      ['Brandschutzklappe', 'Stk'], ['Volumenstromregler', 'Stk'], ['Schalldämpfer', 'Stk'], ['Filter', 'Stk'],
      ['Kaltschrumpfband', 'Rolle'], ['Gewindestange M8', 'm'],
    ],
  },
  {
    id: 'sanitaer',
    name: 'Sanitär',
    taetigkeiten: [
      'Rohinstallation', 'Endmontage', 'Abwasserleitung verlegt', 'Trinkwasserleitung verlegt', 'Vorwandelement gesetzt',
      'Armatur getauscht', 'Druckprobe', 'Spülung', 'Verstopfung beseitigt', 'Wartung',
    ],
    material: [
      ['HT-Rohr DN50', 'm'], ['HT-Rohr DN110', 'm'], ['HT-Bogen', 'Stk'], ['Verbundrohr 16 mm', 'm'], ['Pressfitting', 'Stk'],
      ['Eckventil', 'Stk'], ['Waschtischarmatur', 'Stk'], ['Siphon', 'Stk'], ['Vorwandelement WC', 'Stk'], ['Silikon', 'Stk'],
    ],
  },
  {
    id: 'elektro',
    name: 'Elektro',
    taetigkeiten: [
      'Leitungen verlegt', 'Schlitze gestemmt', 'Dosen gesetzt', 'Verteiler verdrahtet', 'Schalter / Steckdosen montiert',
      'Leuchten montiert', 'Kabeltrasse montiert', 'Messung / Prüfung (VDE)', 'Inbetriebnahme', 'Störungssuche',
    ],
    material: [
      ['NYM-J 3x1,5', 'm'], ['NYM-J 5x1,5', 'm'], ['NYM-J 3x2,5', 'm'], ['NYM-J 5x2,5', 'm'], ['Leerrohr M20', 'm'],
      ['Schalterdose', 'Stk'], ['Abzweigdose', 'Stk'], ['Steckdose', 'Stk'], ['Schalter', 'Stk'], ['LS-Schalter B16', 'Stk'],
      ['FI-Schutzschalter', 'Stk'], ['Wago-Klemme', 'Stk'], ['Kabelrinne', 'm'], ['Datenkabel Cat.7', 'm'], ['Kabelbinder', 'Pkg'],
    ],
  },
  {
    id: 'schreiner',
    name: 'Schreiner',
    taetigkeiten: [
      'Aufmaß', 'Zuschnitt', 'Möbel montiert', 'Türen eingebaut', 'Fenster eingebaut', 'Boden verlegt', 'Küche montiert',
      'Verkleidung montiert', 'Oberflächenbehandlung', 'Reparatur', 'Nacharbeit / Einstellen',
    ],
    material: [
      ['Spanplatte beschichtet', 'm²'], ['Multiplexplatte', 'm²'], ['MDF-Platte', 'm²'], ['Massivholz', 'm³'], ['Kantholz', 'm'],
      ['Leiste', 'm'], ['Türblatt', 'Stk'], ['Zarge', 'Stk'], ['Topfscharnier', 'Stk'], ['Schubkastenauszug', 'Satz'],
      ['Schrauben', 'Pkg'], ['Holzleim', 'Stk'], ['Montageschaum', 'Stk'], ['Acryl / Silikon', 'Stk'],
    ],
  },
  {
    id: 'maurer',
    name: 'Maurer',
    taetigkeiten: [
      'Mauerwerk erstellt', 'Schalung gestellt', 'Bewehrung verlegt', 'Betoniert', 'Verputzt', 'Estrich eingebracht',
      'Durchbruch hergestellt', 'Durchbruch geschlossen', 'Abbrucharbeiten', 'Abdichtung', 'Gerüst gestellt',
    ],
    material: [
      ['Ziegel', 'Stk'], ['Kalksandstein', 'Stk'], ['Porenbetonstein', 'Stk'], ['Mauermörtel', 'Sack'], ['Zement', 'Sack'],
      ['Beton C25/30', 'm³'], ['Putz', 'Sack'], ['Estrich', 'Sack'], ['Baustahlmatte', 'Stk'], ['Betonstahl', 'kg'],
      ['Schalbretter', 'm²'], ['Sturz', 'Stk'], ['Bitumenbahn', 'Rolle'],
    ],
  },
  {
    id: 'maler',
    name: 'Maler',
    taetigkeiten: ['Abgedeckt / abgeklebt', 'Gespachtelt', 'Geschliffen', 'Grundiert', 'Gestrichen', 'Tapeziert', 'Lackiert', 'Fassade gestrichen'],
    material: [
      ['Dispersionsfarbe', 'l'], ['Tiefengrund', 'l'], ['Lack', 'l'], ['Spachtelmasse', 'kg'], ['Malervlies', 'Rolle'],
      ['Abdeckfolie', 'Rolle'], ['Kreppband', 'Rolle'], ['Acryl', 'Stk'],
    ],
  },
  {
    id: 'trockenbau',
    name: 'Trockenbau',
    taetigkeiten: ['Ständerwerk gestellt', 'Beplankt', 'Gedämmt', 'Decke abgehängt', 'Verspachtelt', 'Revisionsöffnung eingebaut'],
    material: [
      ['Gipskartonplatte 12,5 mm', 'm²'], ['CW-Profil', 'm'], ['UW-Profil', 'm'], ['CD-Profil', 'm'], ['Mineralwolle', 'm²'],
      ['Schnellbauschrauben', 'Pkg'], ['Fugenspachtel', 'Sack'], ['Revisionsklappe', 'Stk'],
    ],
  },
  {
    id: 'sonstiges',
    name: 'Sonstiges',
    taetigkeiten: ['Anfahrt', 'Besprechung / Abstimmung', 'Aufmaß', 'Material besorgt', 'Baustelle eingerichtet', 'Aufräumen / Entsorgung', 'Wartezeit'],
    material: [['Kleinmaterial', 'psch'], ['Befestigungsmaterial', 'psch'], ['Entsorgung', 'psch']],
  },
];

const byId = new Map(GEWERKE.map((g) => [g.id, g]));

export function gewerkName(id: string): string {
  return byId.get(id)?.name ?? id;
}

/** Vorschläge des Gewerks plus die allgemeinen aus „Sonstiges“. */
export function vorschlaege(id: string) {
  const g = byId.get(id);
  const s = byId.get('sonstiges')!;
  if (!g || g === s) return { taetigkeiten: s.taetigkeiten, material: s.material };
  return { taetigkeiten: [...g.taetigkeiten, ...s.taetigkeiten], material: [...g.material, ...s.material] };
}
