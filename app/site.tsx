import Link from 'next/link';
export const projects = [
  { slug: 'kinetic', title: 'Kinetic', type: 'Brand system', year: '2026', color: 'blue', text: 'A living identity for ideas still in motion.' },
  { slug: 'common-ground', title: 'Common Ground', type: 'Digital product', year: '2025', color: 'coral', text: 'A calmer way to navigate shared decisions.' },
  { slug: 'afterlight', title: 'Afterlight', type: 'Campaign', year: '2025', color: 'amber', text: 'Making invisible energy feel tangible.' },
];
export const posts = [
  { slug: 'designing-for-change', title: 'Designing for change, not completion', date: '18.08.26', kind: 'Thinking' },
  { slug: 'useful-systems', title: 'When a design system becomes useful', date: '04.07.26', kind: 'Process' },
  { slug: 'show-the-work', title: 'Show the work, leave out the theatre', date: '21.05.26', kind: 'Studio' },
];
export function Header() { return <header className="nav"><Link className="wordmark" href="/">Your Name<span>®</span></Link><nav aria-label="Main navigation"><Link href="/services">Services</Link><Link href="/work">Work</Link><Link href="/about">About</Link><Link href="/blog">Blog</Link><Link href="/news">News</Link></nav><Link className="contact-pill" href="/contact">Contact</Link></header>; }
export function Footer() { return <footer className="site-footer"><p>Available for selected collaborations.</p><Link className="footer-cta" href="/contact">Let’s make<br />something clear. <span>↗</span></Link><div className="footer-meta"><span>Portfolio · 2026</span><div><Link href="/work">Work</Link><Link href="/about">About</Link><Link href="/contact">Contact</Link></div></div></footer>; }
export function Media({ className = '', label }: { className?: string; label: string }) { return <figure className={`media ${className}`}><div className="media-mark" aria-hidden="true"><span /><span /><span /></div><figcaption>{label} · replace with your image or video</figcaption></figure>; }
export function ProjectGrid() { return <div className="project-grid">{projects.map((project) => <Link className="project-card" href={`/work/${project.slug}`} key={project.slug}><div className={`card-media ${project.color}`}><div className="card-orbit" /></div><div className="card-copy"><div><h2>{project.title}</h2><p>{project.text}</p></div><span>{project.type} · {project.year}</span></div></Link>)}</div>; }
export function PageIntro({ label, title, text }: { label: string; title: string; text?: string }) { return <section className="page-intro"><p className="eyebrow">{label}</p><h1>{title}</h1>{text && <p className="intro-copy">{text}</p>}</section>; }
