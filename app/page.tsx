import Link from 'next/link';
import { HomeMotion } from './home-motion';
import { Header, ProjectGrid } from './site';

export default function Home() {
  return <HomeMotion><Header /><main className="home-projects">
    <section className="home-intro">
      <div className="home-intro-top"><span className="home-glyph home-load-item" aria-hidden="true">✣</span><p className="home-load-item">Crafting ( form ), ( function ), ( system ) and ( experience )</p><div className="home-intro-art home-load-item" aria-label="Personal visual placeholder" /></div>
      <div className="home-intro-meta"><p className="home-load-item">▩ 27 ( 08 ) 2026</p><p className="home-load-item">31.2304° N, 121.4737° E<br />22.3193° N, 114.1694° E</p><p className="home-load-item">( Digital )<br />Design + Strategy</p><span className="home-load-item" aria-hidden="true">✨</span></div>
      <div className="home-intro-lines" aria-hidden="true" />
    </section>
    <section className="home-work">
      <header className="home-work-heading" data-home-reveal><h1>Selected Works</h1><Link href="/work">See all available works</Link></header>
      <ProjectGrid featured />
    </section>
    <section className="home-about" data-home-reveal>
      <span className="home-about-mark" aria-hidden="true" />
      <div><h2>Shane is a product designer creating clear, scalable experiences across complex digital products. He turns ambiguous challenges into structured solutions that balance user needs, business goals, and technical realities.</h2><p>His work spans product strategy, interface design, design systems, and cross-platform experiences, carrying ideas from early direction through detailed execution.</p><Link href="/about">Learn more <span>→</span></Link></div>
      <dl><div><dt>Experience</dt><dd>Product-scale UI/UX<br />Responsive web design<br />Visual communication<br />Design systems</dd></div><div><dt>Focus</dt><dd>Digital products<br />IoT experiences<br />Brand systems<br />Interaction design</dd></div><div><dt>Capabilities</dt><dd>Product strategy<br />Interface design<br />Prototyping<br />Creative direction</dd></div></dl>
      <Link className="home-contact" href="/about"><span>Looking for a design partner to elevate your digital presence?</span><strong>/ Let’s connect and collaborate</strong></Link>
    </section>
  </main><footer className="home-footer" data-home-reveal><nav><Link href="/">Home</Link><Link href="/work">Work</Link><Link href="/about">About</Link></nav><nav><a href="#">LinkedIn</a><a href="#">Instagram</a></nav><p>© 2026 Shane Zhu</p><p>▩ 27 ( 08 ) 2026</p></footer></HomeMotion>;
}
