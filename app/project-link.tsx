import Link from 'next/link';

type Project = { slug: string; title: string; type: string; year: string; color: string; text: string; cover?: string; workCover?: string };

export function ProjectLink({ project, featuredIndex }: { project: Project; featuredIndex?: number }) {
  const href = `/work/${project.slug}`;
  const cover = featuredIndex === undefined ? project.workCover ?? project.cover : project.cover;

  return <Link className="project-card" href={href}><div className={`card-media ${project.color}`}>{cover ? <img src={cover} alt="" loading={featuredIndex === 0 ? 'eager' : 'lazy'} draggable={false} data-pin-nopin="true" /> : <span>{project.title.slice(0, 1)}</span>}</div><div className="card-copy"><h2>{project.title}</h2><p>{project.text}</p><small>{featuredIndex === undefined ? `${project.type} · ${project.year}` : `( ${String(featuredIndex + 1).padStart(2, '0')} )`}</small></div></Link>;
}
