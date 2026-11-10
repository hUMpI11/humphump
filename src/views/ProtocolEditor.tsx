import { Header } from '../components/ui';

// GERÜST – wird von Arbeitspaket „Protokoll-Engine“ implementiert.
export default function ProtocolEditor({ projectId, protocolId: _protocolId }: { projectId: string; protocolId: string }) {
  return <Header title="Protokoll" back={`/p/${projectId}/protokolle`} />;
}
