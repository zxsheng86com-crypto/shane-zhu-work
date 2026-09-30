import Link from 'next/link';
import { ProjectLink } from './project-link';
import { Localized } from './localized';
export { Header } from './header';
export type ProjectData = { slug: string; title: string; titleEn?: string; type: string; year: string; color: string; text: string; textEn: string; role?: string; roleEn?: string; scope?: string; scopeEn?: string; tag?: string; tagEn?: string; cover?: string; workCover?: string };
export const projects: ProjectData[] = [
  { slug: 'common-ground', title: 'DJI ROMO', type: 'UI', year: '2025', color: 'stone', text: '大疆首款面向家庭清洁场景的扫拖机器人。', textEn: 'DJI’s first robot vacuum designed for home cleaning.', role: '独立负责', roleEn: 'Sole Designer', scope: '产品 UI、动效设计', scopeEn: 'Product UI, Motion Design', tag: 'APP UI', tagEn: 'APP UI', cover: '/media/dji-romo/01.jpg?v=20260930-still2', workCover: '/media/dji-romo/cover.jpg?v=20260930-still2' },
  { slug: 'dji-avinox', title: 'DJI AVINOX', type: 'GUI', year: '2024', color: 'slate', text: '大疆面向高端山地骑行推出的电助力系统，由中控车屏与 Avinox App 组成。', textEn: 'DJI’s e-bike drive system for premium mountain riding, combining a control display with the Avinox App.', role: '独立负责', roleEn: 'Sole Designer', scope: '品牌、字体、GUI、动效', scopeEn: 'Brand, Type, GUI, Motion', tag: 'GUI / APP UI', tagEn: 'GUI / APP UI', cover: '/media/dji-avinox/01.jpg?v=20260930-still2', workCover: '/media/dji-avinox/cover.jpg?v=20260930-still2' },
  { slug: 'dji-power', title: 'DJI POWER', type: 'GUI', year: '2024', color: 'charcoal', text: 'DJI POWER 是大疆推出的移动储能电源产品线。', textEn: 'DJI POWER is DJI’s portable power product line.', role: '独立负责', roleEn: 'Sole Designer', scope: 'GUI、断码字体', scopeEn: 'GUI, Segment Typeface', tag: 'GUI', tagEn: 'GUI', cover: '/media/dji-power/01.jpg?v=20260930-still2', workCover: '/media/dji-power/cover.jpg?v=20260930-still2' },
  { slug: 'dji-fly', title: 'FLY FPV 2.0', type: 'Digital', year: '2026', color: 'silver', text: 'DJI Fly 面向新一代跟拍机的 FPV 模块升级，聚焦竖屏飞行控制体验。', textEn: 'An FPV module upgrade in DJI Fly for a new generation of tracking drones, focused on portrait flight control.', role: '模块负责', roleEn: 'Module Designer', scope: 'UI、动效', scopeEn: 'UI, Motion', tag: 'APP UI', tagEn: 'APP UI', cover: '/media/dji-fly/cover.jpg?v=20260930-still2', workCover: '/media/dji-fly/cover.jpg?v=20260930-still2' },
  { slug: 'dji-aura-logo', title: 'DJI AURA', type: 'Brand', year: '2026', color: 'graphite', text: 'DJI AURA 是大疆面向影像存储与相册管理推出的云相册服务平台。', textEn: 'DJI AURA is DJI’s cloud album platform for media storage and album management.', role: '独立负责', roleEn: 'Sole Designer', scope: '品牌、标志', scopeEn: 'Brand, Logo', tag: '品牌', tagEn: 'Brand', cover: '/media/dji-aura/01.mp4?v=20260911-r1', workCover: '/media/dji-aura/cover.jpg?v=20260930-still2' },
];
export const posts = [
  { slug: 'designing-for-change', title: 'Designing for change, not completion', date: '18.08.26', kind: 'Thinking' },
  { slug: 'useful-systems', title: 'When a design system becomes useful', date: '04.07.26', kind: 'Process' },
  { slug: 'show-the-work', title: 'Show the work, leave out the theatre', date: '21.05.26', kind: 'Studio' },
];
export function Media({ className = '', label }: { className?: string; label: string }) { return <figure className={`media ${className}`}><figcaption>{label}</figcaption></figure>; }
export function ProjectGrid({ featured = false }: { featured?: boolean }) {
  const list = projects;
  return <div className={`project-grid${featured ? ' home-featured-grid' : ''}`}>{list.map((project, index) => featured
    ? <section className="home-featured-row" data-home-reveal key={project.slug}><ProjectLink project={project} featuredIndex={index} /><div className="home-project-progress" aria-hidden="true">{list.map((item, line) => <i className={line === index ? 'active' : ''} key={item.slug} />)}</div></section>
    : <ProjectLink project={project} key={project.slug} />)}</div>;
}
export function PageIntro({ label, labelZh, title, titleZh, text, textZh }: { label: string; labelZh?: string; title: string; titleZh?: string; text?: string; textZh?: string }) { return <section className="page-intro"><p className="eyebrow"><Localized en={label} zh={labelZh ?? label} /></p><h1><Localized en={title} zh={titleZh ?? title} /></h1>{text && <p className="intro-copy"><Localized en={text} zh={textZh ?? text} /></p>}</section>; }
