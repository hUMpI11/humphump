import { uid } from '../lib/util';
import type { TimeEntry } from '../db';
import type { Row, TableField } from './types';

type Spalten = NonNullable<TableField['quelle']>['spalten'];

/** Stundeneinträge → Tabellenzeilen (neue `_id`, nach Erstellzeit). Reine Funktion, liest und schreibt nichts. */
export function zeilenAusZeiten(zeiten: TimeEntry[], spalten: Spalten): Row[] {
  return [...zeiten]
    .filter((z) => z.minuten > 0)
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((z) => {
      const taetigkeit = [z.taetigkeit.trim(), z.regie ? '(Regie)' : ''].filter(Boolean).join(' ');
      return {
        _id: uid(),
        [spalten.name]: z.mitarbeiter,
        [spalten.taetigkeit]: taetigkeit,
        [spalten.stunden]: Math.round((z.minuten / 60) * 100) / 100,
      };
    });
}
