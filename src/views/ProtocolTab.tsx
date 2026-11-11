import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, touchProject, type Project, type Protocol } from '../db';
import { fmtDate, isoDate, uid } from '../lib/util';
import { go } from '../lib/router';
import { Empty, Fab, Icon, Sheet } from '../components/ui';
import { initialValues, protocolStats } from '../protocols/calc';
import { templateById, templatesFor } from '../protocols/templates';
import type { Template } from '../protocols/types';
import '../protocols/protocols.css';

export default function ProtocolTab({ project }: { project: Project }) {
  const list = useLiveQuery(() => db.protocols.where('projectId').equals(project.id).toArray(), [project.id]);
  const [choosing, setChoosing] = useState(false);

  const sorted = (list ?? []).slice().sort((a, b) => (a.datum < b.datum ? 1 : a.datum > b.datum ? -1 : b.createdAt - a.createdAt));

  async function create(t: Template) {
    const now = Date.now();
    const id = uid();
    await db.protocols.add({
      id,
      projectId: project.id,
      templateId: t.id,
      templateVersion: t.version,
      titel: '',
      datum: isoDate(),
      values: initialValues(t),
      abgeschlossen: false,
      createdAt: now,
      updatedAt: now,
    });
    await touchProject(project.id);
    setChoosing(false);
    go(`/p/${project.id}/protokoll/${id}`);
  }

  const row = (p: Protocol) => {
    const t = templateById(p.templateId);
    const s = t ? protocolStats(t, p.values ?? {}) : null;
    return (
      <li key={p.id}>
        <a className="row" href={`#/p/${project.id}/protokoll/${p.id}`}>
          <span className="row-main">
            <strong>{t?.name ?? 'Unbekannte Vorlage'}</strong>
            {p.titel && <span>{p.titel}</span>}
            <span className="muted">{fmtDate(p.datum)}</span>
            {(s || p.abgeschlossen) && (
              <span className="chips">
                {s && s.mangel > 0 && <span className="chip warn">{s.mangel === 1 ? '1 Mangel' : `${s.mangel} Mängel`}</span>}
                {s && s.offen > 0 && <span className="chip">{s.offen} offen</span>}
                {p.abgeschlossen && <span className="chip on">abgeschlossen</span>}
              </span>
            )}
          </span>
          <Icon name="chevron" size={18} />
        </a>
      </li>
    );
  };

  const templates = templatesFor(project.gewerke);

  return (
    <>
      {list && list.length === 0 && (
        <Empty icon="clipboard" title="Noch keine Protokolle" text="Prüfprotokolle, Checklisten und Aufmaße direkt auf der Baustelle ausfüllen. Tippe auf das Plus und wähle eine Vorlage." />
      )}
      {sorted.length > 0 && <ul className="rows card proto-list">{sorted.map(row)}</ul>}

      <Fab label="Neues Protokoll" onClick={() => setChoosing(true)} />
      {choosing && (
        <Sheet title="Neues Protokoll" onClose={() => setChoosing(false)}>
          {templates.length === 0 ? (
            <p className="muted">Für diese Baustelle gibt es keine Vorlage.</p>
          ) : (
            <ul className="rows card proto-list">
              {templates.map((t) => (
                <li key={t.id}>
                  <button type="button" className="row" onClick={() => create(t)}>
                    <span className="row-main">
                      <strong>{t.name}</strong>
                      <span className="muted">{t.beschreibung}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Sheet>
      )}
    </>
  );
}
