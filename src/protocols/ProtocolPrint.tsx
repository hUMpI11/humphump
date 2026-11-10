import type { Protocol } from '../db';
import type { Template } from './types';

// GERÜST – wird von Arbeitspaket „Protokoll-Engine“ implementiert.
/** Druckansicht eines Protokolls innerhalb des Berichts (<section> mit <h2>, Tabellen wie im restlichen Bericht). */
export function ProtocolPrint({ template, protocol }: { template: Template; protocol: Protocol }) {
  return (
    <section>
      <h2>
        {template.name}
        {protocol.titel ? ` – ${protocol.titel}` : ''}
      </h2>
    </section>
  );
}
