import { Header, ProjectGrid } from '../site';
import { SiteCloseFooter } from '../site-close-footer';
import { HomeProjectPrefetch } from '../project-prefetch';

export default function Work() {
  return <>
    <Header />
    <HomeProjectPrefetch chainWhileIdle />
    <main className="work-index">
      <ProjectGrid />
      <SiteCloseFooter close={false} />
    </main>
  </>;
}
