import { Header } from './site';
import { HomeCarousel } from './home-carousel';

export default function Home() {
  // Single root: HomeCarousel already renders <main className="cf-home">.
  // Nesting another <main className="work-home"> breaks HTML parsing / hydration,
  // which leaves the CSS loader stuck on the SSR shell.
  return <>
    <Header />
    <HomeCarousel />
  </>;
}
