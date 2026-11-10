import type { Template } from './types';

// GERÜST – wird von Arbeitspaket „Vorlagen“ ausgebaut. Schnittstelle (Exporte) bleibt stabil.
export const TEMPLATES: Template[] = [
  {
    id: 'aufmass-flaeche',
    version: 1,
    name: 'Aufmaß Fläche',
    gewerke: ['*'],
    beschreibung: 'Flächen aus Länge × Breite, mit Abzügen.',
    sections: [
      {
        title: 'Positionen',
        fields: [
          {
            id: 'positionen',
            label: 'Positionen',
            type: 'table',
            rowLabel: 'Position',
            columns: [
              { id: 'bezeichnung', label: 'Bezeichnung', type: 'text' },
              { id: 'l', label: 'Länge', type: 'number', unit: 'm' },
              { id: 'b', label: 'Breite', type: 'number', unit: 'm' },
              { id: 'anzahl', label: 'Anzahl', type: 'number', default: 1 },
              { id: 'abzug', label: 'Abzug', type: 'number', unit: 'm²', default: 0 },
              { id: 'flaeche', label: 'Fläche', type: 'number', unit: 'm²', formula: 'l * b * anzahl - abzug' },
            ],
            summary: [{ column: 'flaeche', label: 'Gesamtfläche', unit: 'm²' }],
          },
        ],
      },
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
