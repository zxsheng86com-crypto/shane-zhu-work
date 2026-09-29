import { Header, ProjectGrid } from '../site';
import { SiteCloseFooter } from '../site-close-footer';

export default function Work() {
  return <>
    <Header />
    <main className="work-index">
      <ProjectGrid />
      <SiteCloseFooter close={false} />
    </main>
  </>;
}
