import { Header, ProjectGrid } from '../site';
import { HomeProjectPrefetch } from '../project-prefetch';

export default function Work() {
  return <>
    <Header />
    <HomeProjectPrefetch />
    <main className="work-index">
      <ProjectGrid />
    </main>
  </>;
}
