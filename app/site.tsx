import Link from 'next/link';
export const projects = [
  { slug: 'kinetic', title: 'Kinetic', type: 'Brand', year: '2026', color: 'slate', text: 'A living identity for ideas still in motion.' },
  { slug: 'common-ground', title: 'Common Ground', type: 'Digital', year: '2026', color: 'stone', text: 'A calmer way to navigate shared decisions.' },
  { slug: 'afterlight', title: 'Afterlight', type: 'Campaign', year: '2025', color: 'charcoal', text: 'Making invisible energy feel tangible.' },
  { slug: 'field-notes', title: 'Field Notes', type: 'Brand', year: '2025', color: 'silver', text: 'A system for useful observations.' },
  { slug: 'parallel', title: 'Parallel', type: 'Digital', year: '2025', color: 'graphite', text: 'One platform, many ways forward.' },
  { slug: 'new-ground', title: 'New Ground', type: 'Campaign', year: '2024', color: 'chalk', text: 'An invitation to begin again.' },
  { slug: 'signal', title: 'Signal', type: 'Brand', year: '2024', color: 'smoke', text: 'Complex data made confidently visible.' },
  { slug: 'open-study', title: 'Open Study', type: 'Digital', year: '2024', color: 'ash', text: 'Learning designed around curiosity.' },
];
export const posts = [
  { slug: 'designing-for-change', title: 'Designing for change, not completion', date: '18.08.26', kind: 'Thinking' },
  { slug: 'useful-systems', title: 'When a design system becomes useful', date: '04.07.26', kind: 'Process' },
  { slug: 'show-the-work', title: 'Show the work, leave out the theatre', date: '21.05.26', kind: 'Studio' },
];
export function Header() { return <header className="nav"><Link className="wordmark" href="/">YourName.Studio</Link><nav aria-label="Main navigation"><details><summary>Services</summary><div className="service-menu"><Link href="/services/brand">Brand</Link><Link href="/services/digital">Digital</Link><Link href="/services/campaign">Campaign</Link><Link href="/services">All services</Link></div></details><Link href="/work">Work</Link><Link href="/about">About</Link><Link href="/blog">Blog</Link><Link href="/news">News</Link></nav><Link className="contact-pill" href="/contact">Contact</Link></header>; }
export function Footer() { return <footer className="site-footer"><section className="partner"><h3>Partner with us to create new futures.</h3><Link href="/contact">Get started</Link></section><section className="footer-columns"><div><h4>Ready to build what’s next?</h4><p>Let’s shape what’s possible through purposeful brand, digital and campaign thinking.</p></div><div><p>New Business</p><a href="mailto:hello@example.com">hello@example.com</a><p>General</p><a href="mailto:hello@example.com">hello@example.com</a></div><div><h4>Social Channels</h4><a href="#">Instagram</a><a href="#">LinkedIn</a><a href="#">Pinterest</a></div><div><h4>More</h4><Link href="/about">Approach</Link><Link href="/blog">Insights</Link><Link href="/news">Studio News</Link><Link href="/contact">Contact</Link></div></section><p className="copyright">Copyright © 2026 YourName.Studio</p></footer>; }
export function Media({ className = '', label }: { className?: string; label: string }) { return <figure className={`media ${className}`}><div className="media-mark" aria-hidden="true"><span /><span /><span /></div><figcaption>{label} · replace with your image or video</figcaption></figure>; }
export function ProjectGrid() { return <div className="project-grid">{projects.map((project) => <Link className="project-card" href={`/work/${project.slug}`} key={project.slug}><div className={`card-media ${project.color}`}><span>{project.title.slice(0,1)}</span></div><div className="card-copy"><h2>{project.title}</h2><p>{project.text}</p><small>{project.type} · {project.year}</small></div></Link>)}</div>; }
export function PageIntro({ label, title, text }: { label: string; title: string; text?: string }) { return <section className="page-intro"><p className="eyebrow">{label}</p><h1>{title}</h1>{text && <p className="intro-copy">{text}</p>}</section>; }
