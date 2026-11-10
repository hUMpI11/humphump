import type { Project } from '../db';
import { Empty } from '../components/ui';

// GERÜST – wird von Arbeitspaket „Protokoll-Engine“ implementiert.
export default function ProtocolTab({ project: _project }: { project: Project }) {
  return <Empty icon="clipboard" title="Protokolle" text="Folgt." />;
}
