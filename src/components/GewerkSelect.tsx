import type { Project } from '../db';
import { gewerkName } from '../gewerke';
import { Field } from './ui';

/** Nur sichtbar, wenn die Baustelle mehrere Gewerke hat – sonst ist die Wahl eindeutig. */
export function GewerkSelect({ project, value, onChange }: { project: Project; value: string; onChange: (g: string) => void }) {
  const options = project.gewerke.includes(value) ? project.gewerke : [...project.gewerke, value];
  if (options.length < 2) return null;
  return (
    <Field label="Gewerk">
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((g) => (
          <option key={g} value={g}>
            {gewerkName(g)}
          </option>
        ))}
      </select>
    </Field>
  );
}
