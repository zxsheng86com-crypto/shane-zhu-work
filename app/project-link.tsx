import Link from 'next/link';
import Image from 'next/image';
import { ViewportVideo } from './work/[slug]/viewport-video';
import { Localized } from './localized';
import type { ProjectData } from './site';

const projectEntryVideos: Record<string, string> = {
  'common-ground': '/media/dji-romo/02.mp4?v=20260911-r1',
  'dji-avinox': '/media/dji-avinox/02.mp4?v=20260911-r1',
  'dji-power': '/media/dji-power/03.mp4?v=20260911-r1',
  'dji-aura-logo': '/media/dji-aura/04.mp4?v=20260911-r1',
};

export function ProjectLink({ project, featuredIndex }: { project: ProjectData; featuredIndex?: number }) {
  const href = `/work/${project.slug}`;
  const sourceCover = featuredIndex === undefined ? project.workCover ?? project.cover : project.cover;
  const cover = sourceCover;
  const isVideo = Boolean(cover?.split('?')[0].endsWith('.mp4'));

  return <Link className="project-card" href={href} data-prefetch-media={projectEntryVideos[project.slug]}><div className={`card-media ${project.color}`}>{cover ? isVideo ? <ViewportVideo src={cover} mobile /> : <Image src={cover} fill sizes="(max-width: 800px) 100vw, (max-width: 1200px) 50vw, 33vw" alt="" loading={featuredIndex === 0 ? 'eager' : 'lazy'} unoptimized draggable={false} data-pin-nopin="true" /> : <span>{(project.titleEn ?? project.title).slice(0, 1)}</span>}</div><div className="card-copy"><h2>{project.titleEn ?? project.title}</h2><p><Localized en={project.textEn} zh={project.text} /></p>{featuredIndex !== undefined ? <small>( {String(featuredIndex + 1).padStart(2, '0')} )</small> : null}</div></Link>;
}
