import Link from 'next/link';
import { ProjectLink } from './project-link';
export { Header } from './header';
export const projects = [
  { slug: 'common-ground', title: 'DJI ROMO', type: 'Digital', year: '2026', color: 'stone', text: 'DJI ROMO 是大疆首款家用扫地机器人，标志着品牌向家庭场景的延伸。在扫地机器人市场体验趋于同质化的背景下，设计需要在延续大疆品牌气质的同时，为新产品建立清晰、差异化的视觉识别。', cover: '/media/dji-romo/01.png', workCover: '/media/dji-romo/cover.png' },
  { slug: 'dji-avinox', title: 'DJI AVINOX', type: 'Digital', year: '2026', color: 'slate', text: 'AVINOX 电助力系统是大疆孵化的创新项目，系统主要包括 Avinox App 与中控车屏两部分，面向高端电助力山地骑行场景，为骑手提供骑行数据的实时监控与参数设置。', tags: ['2025', '品牌设计', 'GUI & UI'], cover: '/media/dji-avinox/01.png', workCover: '/media/dji-avinox/cover.png' },
  { slug: 'dji-power', title: 'DJI POWER', type: 'Digital', year: '2026', color: 'charcoal', text: 'DJI Power 是大疆首次涉足移动储能电源品类的产品线，屏幕采用断码屏方案，断码字体是设计的核心。市面上几乎所有同类产品都采用高度相似的断码字体，屏幕呈现趋于同质化。作为大疆全新孵化的产品线，公司期待它能从第一眼就建立品牌辨识度——但断码屏的硬件限制意味着字体只能依赖最基础的段码组合，差异化空间极其有限。', tags: ['2023', 'GUI'], cover: '/media/dji-power/01.png', workCover: '/media/dji-power/cover.png' },
  { slug: 'dji-fly', title: 'DJI FLY', type: 'Digital', year: '2026', color: 'silver', text: 'Project description to be updated.' },
  { slug: 'dji-aura-logo', title: 'DJI AURA logo', type: 'Brand', year: '2026', color: 'graphite', text: 'Project description to be updated.' },
  { slug: 'confidential-project', title: '保密项目', type: 'Confidential', year: '2026', color: 'chalk', text: 'Project details are confidential.' },
];
export const posts = [
  { slug: 'designing-for-change', title: 'Designing for change, not completion', date: '18.08.26', kind: 'Thinking' },
  { slug: 'useful-systems', title: 'When a design system becomes useful', date: '04.07.26', kind: 'Process' },
  { slug: 'show-the-work', title: 'Show the work, leave out the theatre', date: '21.05.26', kind: 'Studio' },
];
export function Footer() { return <footer className="site-footer"><section className="partner"><h3>Partner with us to create new futures.</h3><Link href="/contact">Get started</Link></section><section className="footer-columns"><div><h4>Ready to build what’s next?</h4><p>Let’s shape what’s possible through purposeful brand, digital and campaign thinking.</p></div><div><p>New Business</p><a href="mailto:hello@example.com">hello@example.com</a><p>General</p><a href="mailto:hello@example.com">hello@example.com</a></div><div><h4>Social Channels</h4><a href="#">Instagram</a><a href="#">LinkedIn</a><a href="#">Pinterest</a></div><div><h4>More</h4><Link href="/about">Approach</Link><Link href="/blog">Insights</Link><Link href="/news">Studio News</Link><Link href="/contact">Contact</Link></div></section><p className="copyright">Copyright © 2026 YourName.Studio</p></footer>; }
export function Media({ className = '', label }: { className?: string; label: string }) { return <figure className={`media ${className}`}><figcaption>{label}</figcaption></figure>; }
export function ProjectGrid({ featured = false }: { featured?: boolean }) {
  return <div className={`project-grid${featured ? ' home-featured-grid' : ''}`}>{projects.map((project, index) => featured
    ? <section className="home-featured-row" data-home-reveal key={project.slug}><ProjectLink project={project} featuredIndex={index} /><div className="home-project-progress" aria-hidden="true">{projects.map((item, line) => <i className={line === index ? 'active' : ''} key={item.slug} />)}</div></section>
    : <ProjectLink project={project} key={project.slug} />)}</div>;
}
export function PageIntro({ label, title, text }: { label: string; title: string; text?: string }) { return <section className="page-intro"><p className="eyebrow">{label}</p><h1>{title}</h1>{text && <p className="intro-copy">{text}</p>}</section>; }
