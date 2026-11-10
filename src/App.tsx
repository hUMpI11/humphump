import { parseRoute, useHash } from './lib/router';
import { Empty } from './components/ui';
import ProjectList from './views/ProjectList';
import ProjectForm from './views/ProjectForm';
import ProjectDetail from './views/ProjectDetail';
import Report from './views/Report';
import Settings from './views/Settings';
import SketchEditor from './views/SketchEditor';

export default function App() {
  const route = parseRoute(useHash());
  const activeId = 'id' in route ? route.id : undefined;

  // Der Skizzen-Editor braucht den ganzen Bildschirm, auch auf dem iPad.
  if (route.name === 'skizze') return <SketchEditor key={route.sketchId} projectId={route.id} sketchId={route.sketchId} />;

  let main;
  switch (route.name) {
    case 'neu':
      main = <ProjectForm key="neu" />;
      break;
    case 'bearbeiten':
      main = <ProjectForm key={route.id} id={route.id} />;
      break;
    case 'einstellungen':
      main = <Settings />;
      break;
    case 'bericht':
      main = <Report key={route.id} id={route.id} />;
      break;
    case 'projekt':
      main = <ProjectDetail key={route.id} id={route.id} tab={route.tab} />;
      break;
    default:
      main = (
        <div className="placeholder">
          <Empty icon="info" title="Baustelle auswählen" text="Links eine Baustelle antippen oder eine neue anlegen." />
        </div>
      );
  }

  // Telefon: entweder Liste oder Detail. iPad/Desktop (breit): beides nebeneinander – siehe CSS.
  return (
    <div className={`app ${route.name === 'home' ? 'is-home' : 'is-detail'}`}>
      <aside className="sidebar no-print">
        <ProjectList activeId={activeId} />
      </aside>
      <main className="main">{main}</main>
    </div>
  );
}
