import { Header, ProjectGrid } from '../site';
import { HomeProjectPrefetch } from '../project-prefetch';

export default function Work() {
  return <>
    <Header />
    <HomeProjectPrefetch />
    <main className="work-index">
      <h1 className="work-index-heading">My Work</h1>
      <ProjectGrid />
    </main>
  </>;
}
