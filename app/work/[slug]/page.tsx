import Link from 'next/link';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { notFound } from 'next/navigation';
import { Header, projects } from '../../site';
import { CaseDescription } from './case-description';
import { RevealFlow } from './reveal-flow';
import { ViewportVideo } from './viewport-video';
import { CaseStill } from './case-still';
import type { CSSProperties } from 'react';
import mediaDimensions from '../../media-dimensions.json';
import { Localized } from '../../localized';
import { CaseProjectPrefetch } from '../../project-prefetch';
import { shouldPriorityCaseSlot } from '../../project-opening';

function mobileStillSrc(src: string) {
  const q = src.includes('?') ? src.slice(src.indexOf('?')) : '';
  const bare = src.split('?')[0];
  if (!bare.endsWith('.webp')) return undefined;
  return `${bare.replace(/\/([^/]+)$/, '/mobile/$1')}${q}`;
}

export function generateStaticParams() {
  return projects.map(({ slug }) => ({ slug }));
}

const romoSlots = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31]);
const romoVideos = new Set([2, 6, 7, 8, 9, 10, 11, 12, 13, 14, 17, 18, 19, 20, 21, 22, 23, 28, 31]);
const avinoxSlots = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32]);
const avinoxVideos = new Set([2, 4, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 22, 23, 24, 25, 29, 31]);
const powerSlots = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
const powerVideos = new Set([3, 14, 16]);
const flySlots = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]);
const flyVideos = new Set([7, 8, 9, 10, 11, 12, 13, 14, 15, 19]);
const auraSlots = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
const auraVideos = new Set([1, 4, 8]);

function pad2(slot: number) {
  return String(slot).padStart(2, '0');
}

function publicMedia(...parts: string[]) {
  return path.join(process.cwd(), 'public', 'media', ...parts);
}

/** Only enable /mobile/ when the file actually exists — avoids dead sources on phones. */
function hasMobileVideo(folder: string, slot: number) {
  return existsSync(publicMedia(folder, 'mobile', `${pad2(slot)}.mp4`));
}

function hasMobileStill(folder: string, slot: number) {
  return existsSync(publicMedia(folder, 'mobile', `${pad2(slot)}.webp`));
}

function Placeholder({ number, projectSlug, tone = 'dark', showSlotNumber = true }: { number: number; projectSlug: string; tone?: string; showSlotNumber?: boolean }) {
  const slot = number;
  const media = projectSlug === 'common-ground'
    ? { folder: 'dji-romo', slots: romoSlots, videos: romoVideos }
    : projectSlug === 'dji-avinox'
      ? { folder: 'dji-avinox', slots: avinoxSlots, videos: avinoxVideos }
      : projectSlug === 'dji-power'
        ? { folder: 'dji-power', slots: powerSlots, videos: powerVideos }
        : projectSlug === 'dji-fly'
          ? { folder: 'dji-fly', slots: flySlots, videos: flyVideos }
        : projectSlug === 'dji-aura-logo'
          ? { folder: 'dji-aura', slots: auraSlots, videos: auraVideos }
        : undefined;
  const src = media?.slots.has(slot) ? `/media/${media.folder}/${pad2(slot)}.${media.videos.has(slot) ? 'mp4' : 'webp'}` : undefined;
  const firstVideoSlot = media ? Math.min(...media.videos) : -1;
  const dimensionMap = mediaDimensions as Record<string, { width: number; height: number }>;
  const size = src ? dimensionMap[src] ?? dimensionMap[src.replace(/\.webp$/, '.jpg')] : undefined;
  const mediaSrc = src === '/media/dji-aura/06.webp'
    ? `${src}?v=20261008-media`
    : src === '/media/dji-avinox/02.mp4'
    ? `${src}?v=20261008-faststart`
    : src === '/media/dji-avinox/08.webp'
    ? `${src}?v=20261008-avinox-08`
    : src && projectSlug === 'dji-power'
    ? `${src}?v=20261008-media`
    : src && projectSlug === 'dji-aura-logo'
      ? `${src}?v=20261008-media`
    : src && projectSlug === 'dji-fly' && [7, 8, 10].includes(slot)
      ? `${src}?v=20261008-fly-${pad2(slot)}`
      : src && projectSlug === 'dji-fly'
        ? `${src}?v=20261008-media`
    : src && projectSlug === 'common-ground' ? `${src}?v=20261008-media`
      : src && projectSlug === 'dji-avinox' ? `${src}?v=20261008-media` : src;
  const useMobile = Boolean(media && media.videos.has(slot) && hasMobileVideo(media.folder, slot));
  const stillMobile = media && !media.videos.has(slot) && hasMobileStill(media.folder, slot)
    ? mobileStillSrc(mediaSrc || '')
    : undefined;
  const mediaQuery = mediaSrc?.includes('?') ? mediaSrc.slice(mediaSrc.indexOf('?')) : '';
  const videoPoster = media?.videos.has(slot)
    ? `/media/${media.folder}/posters/${pad2(slot)}.jpg${mediaQuery}`
    : undefined;
  const mobileVideoPoster = useMobile
    ? `/media/${media?.folder}/mobile/posters/${pad2(slot)}.jpg${mediaQuery}`
    : undefined;
  return <figure className={`placeholder ${tone}${src ? ' has-media' : ''}${src === '/media/dji-romo/10.mp4' ? ' trim-edge' : ''}`} style={size ? { '--media-ratio': `${size.width} / ${size.height}` } as CSSProperties : undefined} data-slot={pad2(slot)}>
    {mediaSrc && (media?.videos.has(slot)
      ? <ViewportVideo
          key={`${projectSlug}-${pad2(slot)}-video`}
          src={mediaSrc}
          poster={videoPoster}
          mobilePoster={mobileVideoPoster}
          width={size?.width}
          height={size?.height}
          mobile={useMobile}
          eager={slot === firstVideoSlot}
        />
      : <CaseStill key={`${projectSlug}-${pad2(slot)}-still`} src={mediaSrc} mobileSrc={stillMobile} priority={shouldPriorityCaseSlot(slot)} />)}
    {showSlotNumber && <strong className="slot-number">{String(number).padStart(2, '0')}</strong>}
  </figure>;
}

function Story({ title, titleEn, subtitle, subtitleEn, children, childrenEn }: { title: string; titleEn?: string; subtitle?: string; subtitleEn?: string; children: React.ReactNode; childrenEn?: React.ReactNode }) {
  return <section className={`case-text ${title.toLowerCase()}`}><div><h2><Localized en={titleEn ?? title} zh={title} /></h2>{subtitle && <p><Localized en={subtitleEn ?? subtitle} zh={subtitle} /></p>}</div><CaseDescription><Localized en={childrenEn ?? children} zh={children} /></CaseDescription></section>;
}

const description = 'Use this paragraph for the chapter description. Replace it with the project context, design decisions, and the purpose of the work shown below.';

export default async function Project({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const index = projects.findIndex((item) => item.slug === slug);
  if (index < 0) notFound();
  const project = projects[index];
  const next = projects[(index + 1) % projects.length];
  return <>
    <Header />
    <CaseProjectPrefetch slug={slug} />
    <main className="case-study" data-case-entry="">
      <header className="case-hero">
        <div><p><Localized en={project.titleEn ?? project.title} zh={project.title} /></p><h1><Localized en={project.textEn} zh={project.text} /></h1></div>
        <dl className="case-meta">
          <div><dt><Localized en="Year" zh="年份" /></dt><dd>{project.year}</dd></div>
          <div><dt><Localized en="Scope" zh="范围" /></dt><dd><Localized en={project.scopeEn ?? project.type} zh={project.scope ?? project.type} /></dd></div>
          <div><dt><Localized en="Role" zh="职责" /></dt><dd><Localized en={project.roleEn ?? 'Selected'} zh={project.role ?? '精选项目'} /></dd></div>
        </dl>
      </header>

      <Placeholder number={1} projectSlug={slug} tone={project.color} />

      <RevealFlow>
        {slug === 'dji-fly' ? <>
          <Story title="竖屏体验现状" titleEn="PORTRAIT EXPERIENCE" subtitle="图传小、入口分散，影响飞行操控" subtitleEn="A small live view and scattered entry points disrupt flight control" childrenEn="The existing portrait FPV interface gave limited space to the live view, while feature entry points were scattered and text-heavy, creating information overload. Even with a larger live view, the layout still lacked a clear hierarchy: the next action was unclear on entry, key controls lacked feedback, and panels could interrupt the live view during flight.">现有 FPV 界面图传较小，功能入口分散，文本信息偏多，容易造成信息过载。即使放大图传后，画面仍缺少清晰主次：进入 FPV 时下一步不够明确，操控时重点操作缺少反馈，飞行中面板又容易打断图传画面。</Story>
          <section className="media-block media-pair"><Placeholder number={2} projectSlug={slug} /><Placeholder number={3} projectSlug={slug} /></section>

          <Story title="设计策略" titleEn="DESIGN STRATEGY" subtitle="按连续操控链路重组竖屏体验" subtitleEn="Reframing portrait UI around the flight-control journey" childrenEn="FPV is a continuous control journey rather than a collection of isolated screens. The work follows three stages: entering FPV, beginning control, and sustained flight—so users understand the next step, know what they have controlled and what happened, and remain focused on the flight view.">FPV 是一条连续的操控体验链路。设计不按单个页面拆解，而是围绕进入 FPV、开始操控与持续飞行三个阶段展开：让用户马上明白下一步做什么，清楚自己控制了什么、发生了什么，并在飞行中不被界面打断。</Story>
          <section className="media-block"><Placeholder number={4} projectSlug={slug} /></section>
          <section className="media-block"><Placeholder number={5} projectSlug={slug} /></section>

          <Story title="进入 FPV" titleEn="ENTERING FPV" subtitle="更清晰：让用户一眼知道下一步操作" subtitleEn="Clearer: make the next action immediately obvious" childrenEn="On entering FPV, users need to understand the current state and next action immediately. Modular OSD zones, a live-view-first layout, and consolidated entry points reduce information load and obstruction, while responsive layouts preserve order across different aspect ratios. In intelligent modes, START becomes GO—the core entry point for intelligent tracking. Its multicolour gradient and fluid motion draw attention on entry, while tap feedback confirms that the action has taken effect.">进入 FPV 后，界面首先需要让用户快速理解当前状态与下一步。通过 OSD 模块化分区、图传面积优先与功能入口收拢，减少信息层级和画面遮挡，并为不同画幅建立稳定的适配布局。智能模式中，START 升级为 GO，成为智能跟拍的核心入口。多彩渐变与液态变化在进入页面时吸引注意力，点击反馈则确认操作已生效。</Story>
          <section className="media-block"><Placeholder number={6} projectSlug={slug} /></section>
          <section className="media-block"><Placeholder number={7} projectSlug={slug} /></section>
          <section className="media-block media-pair"><Placeholder number={8} projectSlug={slug} /><Placeholder number={9} projectSlug={slug} /></section>
          <section className="media-block"><Placeholder number={10} projectSlug={slug} /></section>

          <Story title="开始操控" titleEn="BEGINNING CONTROL" subtitle="更可控：让用户清楚操作了什么、发生了什么" subtitleEn="More controllable: make every action and outcome clear" childrenEn="For frequent actions, panel boundaries, selected states, and hierarchy are strengthened. Control transitions and press feedback on key icons make outcomes explicit, while motion explains how modules open and close to establish stable operation paths.">围绕高频操作，强化面板控件的边界、选中态与层级；通过控件切换和重点图标的按压动效，将操作结果直接反馈给用户。动效同时说明模块的展开与收回，帮助用户建立稳定的操作路径。</Story>
          <section className="media-block"><Placeholder number={11} projectSlug={slug} /></section>
          <section className="media-block"><Placeholder number={12} projectSlug={slug} /></section>
          <section className="media-block media-pair"><Placeholder number={13} projectSlug={slug} /><Placeholder number={14} projectSlug={slug} /></section>
          <section className="media-block"><Placeholder number={15} projectSlug={slug} /></section>
          <section className="media-block"><Placeholder number={16} projectSlug={slug} /></section>
          <section className="media-block"><Placeholder number={17} projectSlug={slug} /></section>

          <Story title="持续飞行" titleEn="SUSTAINED FLIGHT" subtitle="更沉浸：让界面辅助飞行，而不是遮挡画面" subtitleEn="More immersive: let the interface support flight, not obstruct it" childrenEn="During flight, the interface should recede. Smaller, less obstructive message banners, contextual hiding of low-priority controls, translucent materials, and continuous OSD transitions replace abrupt changes so attention remains on the live view.">飞行过程中，UI 的目标是退后。通过降低消息横幅的面积与遮挡、按场景隐藏低优先级控件，并以通透材质和连续的 OSD 状态过渡替代突兀跳变，让用户的注意力始终留在图传画面。</Story>
          <section className="media-block media-pair"><Placeholder number={18} projectSlug={slug} /><Placeholder number={19} projectSlug={slug} /></section>
          <section className="media-block"><Placeholder number={20} projectSlug={slug} /></section>
          <section className="media-block"><Placeholder number={21} projectSlug={slug} /></section>

          <Story title="FPV 组件与动效规范" titleEn="FPV COMPONENT AND MOTION GUIDELINES" subtitle="统一视觉样式与交互反馈" subtitleEn="Unifying visual styles and interaction feedback" childrenEn="A component style library was established for the FPV interface, alongside fixed elastic curves and duration rules for different interaction scenarios. Motion components in Figma prototypes directly show element transitions and their assigned curves, allowing developers to review interaction paths and motion parameters by scenario, reducing communication and implementation variance.">围绕 FPV 界面建立组件样式库，并为不同交互场景定义固定的弹性曲线与时长规则。动效组件在 Figma 原型中直接呈现元素之间的跳转关系与所用曲线，开发可按场景查看交互路径和动效参数，减少沟通与还原偏差。</Story>
          <section className="media-block"><Placeholder number={22} projectSlug={slug} /></section>
          <section className="media-block"><Placeholder number={23} projectSlug={slug} /></section>
          <section className="media-block"><Placeholder number={24} projectSlug={slug} /></section>
        </> : slug === 'dji-avinox' ? <>
          <Story title="LOGO" childrenEn="Built from DJI Font, the AVINOX logo refines the letterforms for tighter balance and a distinct product identity.">AVINOX 的 Logo 基于 DJI 品牌字体 DJI Font 进行设计，通过对字形结构的视觉平衡与调整，使整体更加紧凑，具备独立品牌标识的识别感。</Story>
          <section className="media-block"><Placeholder number={2} projectSlug={slug} /></section>

          <Story title="硬件挑战" titleEn="HARDWARE CHALLENGE" subtitle="在短暂扫视中识别关键信息" subtitleEn="Recognising critical information at a glance" childrenEn="The 2-inch OLED display is fixed low on the bike frame, roughly 50 cm from the rider and outside the natural viewing zone. Unlike a phone or watch, its viewing distance and angle cannot be adjusted. In bright light, constant vibration, and high-speed motion, riders can only glance at the screen briefly. The core challenge was to make ride data and critical status immediately recognisable within a limited display and constrained field of view.">AVINOX 中控屏采用 2 英寸 OLED 屏幕，固定于车架中下方，与人眼相距约 50 厘米，并偏离自然舒适视区，用户无法像使用手机或手表一样自由调整观看距离与角度。在户外强光、持续颠簸和高速运动中，骑手只能短暂扫视屏幕。如何在有限尺寸与受限视域中，让骑行数据和关键状态被快速识别，是车屏设计面临的核心挑战。</Story>
          <section className="media-block media-pair"><Placeholder number={3} projectSlug={slug} /><Placeholder number={4} projectSlug={slug} /></section>

          <Story title="设计策略" titleEn="DESIGN STRATEGY" subtitle="从骑行限制建立信息规则" subtitleEn="Turning riding constraints into information rules" childrenEn="Early research combined category-product experience, competitor analysis, and repeated field tests to understand the e-MTB riding context. Hardware constraints and field findings were translated into three design principles: establish type sizes and information hierarchy for riding and non-riding contexts so critical data remains clear at a glance; use a clear information structure and content hierarchy so core data and frequent functions are quickly accessible; and use graphics, colour, motion, and state feedback to make complex data and vehicle status intuitive.">设计前期通过行业产品体验、竞品分析与多轮骑行外测，建立对电助力山地骑行场景的认知，并将硬件限制与实测反馈转化为三项设计原则：在骑行与非骑行场景中建立字号和信息层级，确保关键数据在短暂注视下仍然清晰可读；以清晰的信息结构与内容层级，让核心数据与高频功能能够被快速获取；再通过图形、色彩、动效与状态反馈，让复杂数据与车辆状态能够被直觉感知。</Story>
          <section className="media-block"><Placeholder number={5} projectSlug={slug} /></section>

          <Story title="字体设计" titleEn="TYPEFACE DESIGN" subtitle="专为山地骑行打造的品牌字体" subtitleEn="A brand typeface built for mountain riding" childrenEn="AVINOX Font was created for the control display, using motion and speed as its visual direction. Rider testing informed a 12° forward slant, giving the system a distinctive character aligned with premium e-MTB riding.">AVINOX FONT 是专为中控车屏定制的字体，以运动感与速度感为设计方向。结合多次骑行测试中用户对字形倾角的偏好反馈，采用 12° 前倾设计，在塑造品牌辨识度的同时，让车屏的视觉气质与电助力山地骑行场景相呼应。</Story>
          <section className="media-block"><Placeholder number={6} projectSlug={slug} /></section>
          <section className="media-block"><Placeholder number={7} projectSlug={slug} /></section>

          <Story title="车屏字号规范" titleEn="DISPLAY TYPOGRAPHY" subtitle="从场景差异建立字体与字号规则" subtitleEn="Type and scale defined by use context" childrenEn="Human-factors research and ISO 15008 informed the type and size rules for riding and non-riding contexts. AVINOX Font carries primary ride data and brand character; D-DIN Condensed supports system and secondary information with compact, stable forms.">参考人因研究及 ISO 15008 车内视觉显示规范分析，定义骑行与非骑行状态下的字体及字号规则。AVINOX Font 用于核心骑行数据，强化运动感与品牌识别；D-DIN Condensed 用于系统与辅助信息，以紧凑、稳定的字形提升信息承载与阅读清晰度。</Story>
          <section className="media-block"><Placeholder number={8} projectSlug={slug} /></section>

          <Story title="信息框架策略" titleEn="INFORMATION FRAMEWORK" subtitle="以框架规则统一信息层级与密度" subtitleEn="A consistent hierarchy across changing data" childrenEn="Two display frameworks follow the rider’s scan path. Type size, position, and data count establish a stable hierarchy, allowing different data sets to change without disrupting reading order.">基于骑行中的扫读路径，定义两套车屏信息框架，并通过字号、位置与数据数量建立统一的信息层级和密度规则。不同类型的数据可以在框架内灵活组合，使界面在内容变化时仍保持稳定的读取顺序。</Story>
          <section className="media-block"><Placeholder number={9} projectSlug={slug} /></section>
          <section className="media-block media-pair"><Placeholder number={10} projectSlug={slug} /><Placeholder number={11} projectSlug={slug} /></section>

          <Story title="车屏运动数据" titleEn="RIDE DATA" subtitle="用图形强化数据识别" subtitleEn="Using graphics to speed up recognition" childrenEn="During localisation, scrolling labels can consume display space and interrupt the reading of changing values. Key text is consolidated into icons, while additional visualisations keep attention on values and their change.">骑行数据在多语言适配时容易出现文字滚动，挤占显示空间并干扰数值读取。设计将部分文字信息合并至 Icon，并增加图形化呈现，让用户更专注于数值及其变化。</Story>
          <section className="media-block"><Placeholder number={12} projectSlug={slug} /></section>
          <section className="media-block media-pair"><Placeholder number={13} projectSlug={slug} /><Placeholder number={14} projectSlug={slug} /></section>

          <Story title="BOOST 模式" titleEn="BOOST MODE" subtitle="强化瞬时动力感知" subtitleEn="Making instant power perceptible" childrenEn="Boost delivers a short burst of power. Lines radiate from the centre, using speed, direction, and rhythm to make the change felt—not only measured.">Boost 模式会在短时间内释放更强的动力输出。界面采用由中心向外扩散的线条动效，通过速度、方向与节奏变化强化模式开启时的瞬时反馈，让动力变化不仅体现在数值上，也能被用户直接感知。</Story>
          <section className="media-block"><Placeholder number={15} projectSlug={slug} /></section>

          <Story title="下拉控制中心" titleEn="CONTROL CENTRE" subtitle="以更少信息承载更多快捷操作" subtitleEn="More shortcuts with less information" childrenEn="The control centre concentrates high-frequency actions during a ride. Redundant labels and low-frequency settings were removed; a shared card structure and graphic cues keep density controlled and make actions recognisable without full labels.">下拉控制中心承载骑行中的高频操作。设计删减冗余标题与低频设置，以统一卡片结构和图形识别区分功能，在有限空间内控制信息密度，使用户无需阅读完整文字即可快速操作。</Story>
          <section className="media-block"><Placeholder number={16} projectSlug={slug} /></section>

          <Story title="推车模式" titleEn="WALK ASSIST" subtitle="将关键状态转化为操作判断依据" subtitleEn="Turning live status into clear decisions" childrenEn="Walk Assist reduces effort on steep slopes and supports rapid gear changes with the rear wheel lifted. Live gradient graphics help riders judge when to shift, while linked gear animation and values make each change immediately visible.">推车模式是骑手在陡坡场景下提供电助力，减轻推车压力，同时支持在陡坡中抬起后轮快速切换变速档位。经过多轮外测骑行测试与需求调整，最终确认了功能与图形相结合的可视化方案：触发推车模式后，屏幕实时显示当前坡度情况，用户可据此判断是否需要换挡变速。快速变档部分提供了齿轮换挡的可视化设计，图形与数值的联动变化提升了复杂环境下的信息获取效率。</Story>
          <section className="media-block media-stack reverse"><div><Placeholder number={17} projectSlug={slug} /><Placeholder number={18} projectSlug={slug} /></div><Placeholder number={19} projectSlug={slug} /></section>
          <section className="media-block"><Placeholder number={20} projectSlug={slug} /></section>

          <Story title="APP ICON" childrenEn="Built from the AVINOX lettermark, the app icon borrows the speed lines from Boost mode to connect the app with the display’s motion language.">APP ICON 以 AVINOX 字母标识为基础，从 Boost 模式的速度线条中提取视觉特征，使 App 图标与车屏中的动态语言保持一致。</Story>
          <section className="media-block media-pair"><Placeholder number={21} projectSlug={slug} /><Placeholder number={22} projectSlug={slug} /></section>

          <Story title="APP 首页设计" titleEn="APP HOME" subtitle="连接车屏状态与骑行服务" subtitleEn="Connecting ride status with system services" childrenEn="The display prioritises immediate ride information; the app handles device management, settings, and services. A shared data structure and visual language connect both surfaces, letting riders configure in the app and read critical status on the bike.">车屏聚焦骑行过程中的即时信息，App 首页则承接设备管理、参数设置与骑行服务。两端采用一致的数据结构与视觉语言，用户可以在 App 中完成复杂配置，并在骑行过程中通过车屏快速获取关键状态，使不同设备根据使用场景形成明确分工。</Story>
          <section className="media-block"><Placeholder number={23} projectSlug={slug} /></section>
          <section className="media-block media-pair"><Placeholder number={24} projectSlug={slug} /><Placeholder number={25} projectSlug={slug} /></section>

          <Story title="导航功能" titleEn="OFFLINE NAVIGATION" childrenEn="Unlike conventional online navigation, AVINOX supports offline routes. Riders download professional route files, import them on the phone, and send them to the display for use beyond network coverage.">AVINOX 的导航功能定位为离线导航，区别于市面常见的在线导航方案。用户通过下载专业骑行路线文件，上传至手机后发送至中控屏，即可在无网络覆盖的户外骑行环境中使用导航功能。</Story>
          <section className="media-block media-pair"><Placeholder number={26} projectSlug={slug} /><Placeholder number={27} projectSlug={slug} /></section>

          <Story title="App 运动数据" titleEn="APP RIDE DATA" childrenEn="While the display supports rapid in-ride scanning, the app provides space for a fuller view of ride data. Information is organised by reading priority, making changes across multiple metrics easier to review.">车屏服务于骑行中的快速扫读，App 则提供更完整的数据查看空间。设计按阅读优先级组织多维数据，让用户在更大界面中查看数据变化。</Story>
          <section className="media-block"><Placeholder number={28} projectSlug={slug} /></section>

          <Story title="车屏设置" titleEn="DISPLAY SETTINGS" childrenEn="Users configure the display’s data types and quantity in the app, then sync them to the display. Separating complex setup from in-ride information keeps the display simple while supporting individual preferences.">用户可在 App 中配置车屏显示的数据类型与数量，再同步至车屏。通过将复杂配置与骑行中的即时信息分开，车屏保持简洁，也能满足个性化需求。</Story>
          <section className="media-block"><Placeholder number={29} projectSlug={slug} /></section>
          <section className="media-block"><Placeholder number={30} projectSlug={slug} /></section>
          <section className="media-block"><Placeholder number={31} projectSlug={slug} /></section>
          <section className="media-block"><Placeholder number={32} projectSlug={slug} /></section>
        </> : slug === 'dji-power' ? <>
          <Story title="核心挑战" titleEn="CORE CHALLENGE" subtitle="在断码限制中建立品牌辨识度" subtitleEn="Building brand distinction within segment constraints" childrenEn="Portable-power displays commonly use similar segmented type and information layouts, resulting in highly uniform screen experiences. As the first product in the DJI POWER line, the interface needed to present device information clearly while establishing a distinctly DJI identity. Because segmented displays rely on fixed strokes, letterforms, information density, and layout space are tightly constrained. The core challenge was to balance readability, brand distinction, and future product expansion within those limits.">同类移动储能产品普遍采用相似的断码字体与信息布局，屏幕表达高度趋同。作为 DJI POWER 产品线的首款产品，界面既要清晰呈现设备信息，也需要建立属于大疆的品牌识别。断码屏依靠固定笔画组合显示内容，字形结构、信息密度和布局空间均受到限制。如何在有限条件下兼顾读取效率、品牌辨识度与产品延展，是项目的核心挑战。</Story>
          <section className="media-block"><Placeholder number={2} projectSlug={slug} /></section>

          <Story title="字体设计" titleEn="SEGMENT TYPEFACE" subtitle="从 DJI 字形特征建立断码字体" subtitleEn="Building segmented type from DJI letterforms" childrenEn="The segmented typeface extracts the slant and curvature of the DJI logo. The original 15° angle made characters too wide for the fixed display, so it was reduced to 7.5°—preserving brand character while improving density and efficiency.">断码字体的设计上，通过提炼 DJI Logo 的倾斜与弧度作为视觉锤，针对 Logo 原始 15° 倾斜角在固定尺寸断码屏上导致字符过宽、信息密度不足的问题，将倾斜角度优化至 7.5°，在延续品牌气质的前提下，大幅提升信息展示的紧凑度与效率。</Story>
          <section className="media-block"><Placeholder number={3} projectSlug={slug} /></section>

          <Story title="字号 & 颜色规范" titleEn="TYPE SCALE & COLOUR" subtitle="从硬件特征建立显示规范" subtitleEn="Display rules derived from hardware" childrenEn="Four type sizes establish a clear reading order within the constraints of a segmented display. The accent colour comes from the product’s orange hardware ports, carrying the industrial identity into the interface and unifying hardware and screen.">基于断码屏特殊的硬件显示机制，定义了 4 种基础字号层级，在满足硬件识别特性的前提下，建立起严谨的信息阅读秩序。在色彩体系上，从产品硬件 ID 的接口橙色中提取灵感，确立为主题色。确保了跨媒介的色彩一致性，更将硬件的工业质感延伸至屏幕界面，强化了产品的整体感。</Story>
          <section className="media-block media-pair"><Placeholder number={4} projectSlug={slug} /><Placeholder number={5} projectSlug={slug} /></section>

          <Story title="图形设计" titleEn="GRAPHIC DESIGN" subtitle="从硬件接口提取图形语言" subtitleEn="Graphics derived from hardware interfaces" childrenEn="The graphic system extracts structural features from the product’s physical interfaces and translates them into simple, recognisable functional symbols. A geometry of rounded and angular forms echoes the product silhouette and industrial details, unifying the display graphics with the hardware.">图形设计提取产品真实接口的结构特征，并将其转化为简洁、易识别的功能图形。通过方圆结合的几何规则呼应机身轮廓与工业设计细节，使屏幕图形与产品外观形成统一的视觉语言。</Story>
          <section className="media-block"><Placeholder number={6} projectSlug={slug} /></section>
          <section className="media-block"><Placeholder number={7} projectSlug={slug} /></section>
          <section className="media-block media-pair"><Placeholder number={8} projectSlug={slug} /><Placeholder number={9} projectSlug={slug} /></section>

          <Story title="布局设计" titleEn="LAYOUT SYSTEM" subtitle="以稳定结构统一信息秩序" subtitleEn="A stable structure for consistent information" childrenEn="A stable, minimal layout keeps the visual centre balanced as content changes, giving users a clear and consistent reading experience.">整体界面采用稳定、简约的布局结构进行内容划分。确保在切换不同显示内容时，视觉重心始终保持居中与平衡，给用户提供了清晰、稳定的视觉体验。</Story>
          <section className="media-block media-pair"><Placeholder number={10} projectSlug={slug} /><Placeholder number={11} projectSlug={slug} /></section>
          <section className="media-block"><Placeholder number={12} projectSlug={slug} /></section>
          <section className="media-block"><Placeholder number={13} projectSlug={slug} /></section>

          <Story title="其他断码设计" titleEn="SYSTEM EXTENSION" subtitle="让核心规范适配不同产品" subtitleEn="Extending core rules across products" childrenEn="As DJI’s portable-power range expanded, the established segmented-display system—type, colour, and layout—adapted across product roles and screen sizes, improving design efficiency while preserving a consistent family identity.">随着大疆储能产品线持续扩展，基于前期建立的断码屏设计系统（字号、色彩与布局规范），适配不同功能定位与屏幕规格，在提升设计效率的同时保持产品家族的视觉一致性。</Story>
          <section className="media-block media-pair"><Placeholder number={14} projectSlug={slug} /><Placeholder number={15} projectSlug={slug} /></section>

          <Story title="白牌项目" titleEn="WHITE-LABEL PROJECTS" subtitle="以模块化设计适配不同市场" subtitleEn="Modular design for different markets" childrenEn="For overseas tariff and compliance requirements, a white-label UI strategy retained the core interaction model while removing or recomposing brand elements through modular visual replacement. This met local compliance and brand needs while reducing the cost of parallel design and development.">面向海外市场的关税与合规要求，制定白牌机型 UI 适配策略。在保留核心交互逻辑的基础上，通过品牌元素剥离与视觉模块替换，满足不同市场的合规与品牌需求，并降低多版本并行的设计与开发成本。</Story>
          <section className="media-block media-pair"><Placeholder number={16} projectSlug={slug} /><Placeholder number={17} projectSlug={slug} /></section>
          <section className="media-block"><Placeholder number={18} projectSlug={slug} /></section>
        </> : slug === 'dji-aura-logo' ? <>
          <Story title="LOGO DESIGN" subtitle="灵光与影像" subtitleEn="Aura and imagery" childrenEn="The DJI AURA mark brings together two ideas: aura and imagery. A radiating flame turns light and presence into a symbol of memories preserved in the cloud. A play icon is embedded in the form to represent both photos and video.">
            DJI AURA 的标志围绕“灵光”与“影像”两个概念展开。“Aura”意为光环与气息，设计将其转化为向外迸发的光焰，表达云端相册对影像记忆的保存与延续；同时将播放键的几何轮廓融入图形，回应照片与视频的媒体属性。
          </Story>
          <section className="media-block"><Placeholder number={2} projectSlug={slug} /></section>
          <section className="media-block"><Placeholder number={3} projectSlug={slug} /></section>
          <section className="media-block"><Placeholder number={4} projectSlug={slug} /></section>
          <section className="media-block"><Placeholder number={5} projectSlug={slug} /></section>
          <section className="media-block"><Placeholder number={6} projectSlug={slug} /></section>
          <section className="media-block media-pair"><Placeholder number={7} projectSlug={slug} /><Placeholder number={8} projectSlug={slug} /></section>
          <section className="media-block media-pair"><Placeholder number={9} projectSlug={slug} /><Placeholder number={10} projectSlug={slug} /></section>
          <section className="media-block"><Placeholder number={11} projectSlug={slug} /></section>
          <section className="media-block"><Placeholder number={12} projectSlug={slug} /></section>
        </> : <>
        {slug === 'common-ground' ? <>
          <Story title="核心挑战" titleEn="CORE CHALLENGE" subtitle="在成熟品类中建立产品辨识度" subtitleEn="Building distinction in a mature category" childrenEn="After years of development, robot vacuums have matured in both features and interaction patterns, and competitors’ software visuals have grown increasingly alike. As a new entrant, DJI’s core goal for ROMO was to deliver a differentiated product experience. The transparent body and precision structure already give the hardware a distinctive identity; for ROMO, the core challenge in software design was building from the ground up a visual system that connects to the hardware and carries the aesthetics of its industrial design.">扫拖机器人市场经过多年发展，产品功能与交互方式已高度成熟，竞品的软件视觉逐渐趋同。大疆作为入局者，如何给到市场差异化的产品体验是 ROMO 的核心目标。透明机身与精密结构已经赋予硬件外观鲜明的产品识别，对 ROMO 来说，从 0 到 1 建立一套与硬件关联、承载 ID 美学特征的视觉体系，是软件设计的核心挑战。</Story>
          <section className="media-block"><Placeholder number={2} projectSlug={slug} /></section>

          <Story title="设计策略" titleEn="DESIGN STRATEGY" subtitle="从透明结构延伸到软件体验" subtitleEn="Extending transparent hardware into software" childrenEn="ROMO’s transparent shell exposes its precision engineering and gives the hardware a distinctive identity. In the direction proposal stage, this informed two principles for software: structural visualisation and functional motion make device state visible, while restrained colour, typography, and space support the hardware details. Together, they guide the core experience and create one product language across software and hardware.">ROMO 以透明机身呈现内部精密结构，硬件已建立鲜明的产品辨识度。方向提案阶段，软件据此确立两项表达：以结构可视化与功能动效呈现设备状态；以克制的色彩、排版与留白衬托设备细节。两者共同贯穿核心体验，使软件与硬件形成统一的产品体验。</Story>
          <section className="media-block"><Placeholder number={3} projectSlug={slug} /></section>
        </> : <>
          <Story title="挑战" titleEn="CHALLENGE" childrenEn="This chapter introduces the project context, design decisions, and the work shown below.">{description}</Story>
          <section className="media-block"><Placeholder number={2} projectSlug={slug} /></section>
          <section className="media-block"><Placeholder number={3} projectSlug={slug} /></section>
        </>}

        <Story title="APP ICON" subtitle={slug === 'common-ground' ? '从清洁轨迹建立品牌识别' : undefined} subtitleEn={slug === 'common-ground' ? 'Building recognition from cleaning motion' : undefined} childrenEn={slug === 'common-ground' ? 'The icon extracts the spreading and suction paths of the robot’s cleaning motion and turns them into a concise graphic language.' : 'This chapter introduces the design decisions and the work shown below.'}>{slug === 'common-ground' ? 'APP ICON 从扫地机器人清洁时的扩散、吸入的运动轨迹提取特征，将其转化为简洁的图形语言。' : description}</Story>
        <section className="media-block media-pair"><Placeholder number={4} projectSlug={slug} /><Placeholder number={5} projectSlug={slug} /></section>

        <Story title="HOME PAGE" subtitle={slug === 'common-ground' ? '以简驭繁，让设备状态直观可见' : undefined} subtitleEn={slug === 'common-ground' ? 'A restrained interface that makes status visible' : undefined} childrenEn={slug === 'common-ground' ? 'Most category home screens use a static product image on white, carrying no status information. ROMO makes the animated device the visual focus and keeps the surrounding UI restrained. Users can understand live operating states directly from the home screen.' : 'This chapter introduces the design decisions and the work shown below.'}>{slug === 'common-ground' ? '同类产品的首页通常以白底静态设备图，设备图本身不承载状态信息。ROMO 以设备动态效果作为视觉核心，UI 保持克制、直白，通过简洁界面衬托透明 ID 的精密结构。用户在首页可以直观了解设备的实时运行状态变化。' : description}</Story>
        <section className="media-block media-pair"><Placeholder number={6} projectSlug={slug} /><Placeholder number={7} projectSlug={slug} /></section>
        <section className="media-block"><Placeholder number={8} projectSlug={slug} /></section>
        <section className="media-block"><Placeholder number={9} projectSlug={slug} /></section>

        <Story title="桌面小组件" titleEn="HOME WIDGET" subtitle={slug === 'common-ground' ? '将设备状态延伸至系统桌面' : undefined} subtitleEn={slug === 'common-ground' ? 'Extending device status to the system home screen' : undefined} childrenEn={slug === 'common-ground' ? 'The widget carries the home screen’s status-led approach into the system layer, surfacing operating states and frequent actions without opening the app.' : 'This chapter introduces the design decisions and the work shown below.'}>{slug === 'common-ground' ? '小组件延续首页的设备状态可视化的表达，将运行状态与常用功能带到系统桌面，使用户无需进入 App 即可了解设备情况。' : description}</Story>
        <section className="media-block"><Placeholder number={10} projectSlug={slug} /></section>

        <Story title="定时清洁" titleEn="SCHEDULED CLEANING" subtitle={slug === 'common-ground' ? '让任务状态可感知' : undefined} subtitleEn={slug === 'common-ground' ? 'Making task status immediately perceptible' : undefined} childrenEn={slug === 'common-ground' ? 'When a schedule starts, the alarm icon enters a dedicated motion state. This distinguishes scheduled from manual cleaning and confirms both task source and activation.' : 'This chapter introduces the design decisions and the work shown below.'}>{slug === 'common-ground' ? '定时任务触发时，首页闹钟图标进入专属执行动效，区分定时计划与手动任务，让用户直接确认任务来源与生效状态。' : description}</Story>
        <section className="media-block media-stack reverse"><div><Placeholder number={11} projectSlug={slug} /><Placeholder number={12} projectSlug={slug} /></div><Placeholder number={13} projectSlug={slug} /></section>

        <Story title="基站功能" titleEn="BASE STATION" subtitle={slug === 'common-ground' ? '耗材与运行状态直接可见' : undefined} subtitleEn={slug === 'common-ground' ? 'Consumables and operation, directly visible' : undefined} childrenEn={slug === 'common-ground' ? 'The base-station entry reveals dust-bag and mop status through a transparent structure, then uses entry and running motion to show task progress. Motion focuses on reusable components rather than the full device, allowing the system to adapt to future models and hardware changes. This component-level approach has since been reused on later models.' : 'This chapter introduces the design decisions and the work shown below.'}>{slug === 'common-ground' ? '基站入口通过透明结构呈现尘袋、拖布等耗材状态，执行任务时以进入与运行动态反馈当前进程。弹窗动效聚焦关键部件而非完整设备外形，使同一套表达能够适配后续机型与产品结构变化，并已在后续机型中复用。' : description}</Story>
        <section className="media-block"><Placeholder number={14} projectSlug={slug} /></section>
        <section className="media-block media-pair"><Placeholder number={15} projectSlug={slug} /><Placeholder number={16} projectSlug={slug} /></section>
        <section className="media-block"><Placeholder number={17} projectSlug={slug} /></section>

        <Story title="地图设计" titleEn="MAP DESIGN" subtitle={slug === 'common-ground' ? '减少装饰色彩，突出路径与操作' : undefined} subtitleEn={slug === 'common-ground' ? 'Less decorative colour, clearer paths and actions' : undefined} childrenEn={slug === 'common-ground' ? 'Competitors often use multiple colours to separate rooms, although repeated colours do not express real spatial relationships. After exploring both multi-colour and restrained directions, ROMO chose the latter to prioritise routes, operating state, and editing actions. Furniture, no-go zones, and thresholds share consistent selection and editing rules to keep complex operations clear.' : 'This chapter introduces the design decisions and the work shown below.'}>{slug === 'common-ground' ? '同类竞品地图通常使用多种色块区分房间，但重复出现的颜色并不能表达房间之间的实际关系。基于多色与克制两套方向探索，最终选择克制方向，以减少装饰性色彩，将视觉重点留给设备路径、运行状态和编辑操作；同时为家具、禁区、门槛等地图元素建立统一的选择与编辑方式，使复杂操作保持清晰一致。' : description}</Story>
        <section className="media-block"><Placeholder number={18} projectSlug={slug} /></section>
        <section className="media-block media-pair"><Placeholder number={19} projectSlug={slug} /><Placeholder number={20} projectSlug={slug} /></section>

        <Story title="清洁模式" titleEn="CLEANING MODES" subtitle={slug === 'common-ground' ? '统一规则承载复杂参数' : undefined} subtitleEn={slug === 'common-ground' ? 'One rule set for complex parameters' : undefined} childrenEn={slug === 'common-ground' ? 'A consistent “information left, controls right” layout reduces interaction to taps and sliders. This lowers the cost of understanding complex settings, leaves room for future options, and adds animated icons to reinforce level changes.' : 'This chapter introduces the design decisions and the work shown below.'}>{slug === 'common-ground' ? '清洁模式采用“左侧信息、右侧控件”的统一布局，将操作收敛为点按与滑动两类控件，在降低复杂参数理解成本的同时，为后续新增设置项保留扩展空间。同时新增不同档位的 Icon 动效，提升交互反馈体验。' : description}</Story>
        <section className="media-block media-pair"><Placeholder number={21} projectSlug={slug} /><Placeholder number={22} projectSlug={slug} /></section>

        <Story title="设备设置" titleEn="DEVICE SETTINGS" subtitle={slug === 'common-ground' ? '将设备逻辑转化为可视化反馈' : undefined} subtitleEn={slug === 'common-ground' ? 'Turning device logic into visual feedback' : undefined} childrenEn={slug === 'common-ground' ? 'Pet and carpet modes involve internal behaviours that text and parameters cannot explain alone. Device motion and state graphics demonstrate the change directly, helping users understand each mode before enabling it.' : 'This chapter introduces the design decisions and the work shown below.'}>{slug === 'common-ground' ? '宠物模式、地毯模式等设置涉及设备内部的运行逻辑，仅靠文字和参数难以理解。设计通过设备动效与状态图形直接演示模式变化，让用户在设置前即可理解功能作用。' : description}</Story>
        <section className="media-block media-stack reverse"><div><Placeholder number={23} projectSlug={slug} /><Placeholder number={24} projectSlug={slug} /></div><Placeholder number={25} projectSlug={slug} /></section>
        <section className="media-block"><Placeholder number={26} projectSlug={slug} /></section>
        <section className="media-block"><Placeholder number={27} projectSlug={slug} /></section>
        <section className="media-block"><Placeholder number={28} projectSlug={slug} /></section>
        <section className="media-block"><Placeholder number={29} projectSlug={slug} /></section>
        {slug === 'common-ground' && <>
          <Story title="项目结果" titleEn="PROJECT OUTCOME" subtitle="内部认可与外部专业评价" subtitleEn="Internal recognition and external professional feedback" childrenEn="ROMO received a departmental Excellence Project Award. After launch, multiple leading KOLs gave positive feedback on the software design in their reviews.">ROMO 获得部门颁发的卓越项目奖。产品发布后，多位头部 KOL 在评测内容中对软件设计给予正向评价。</Story>
          <section className="media-block media-pair" aria-label="Project results media"><Placeholder number={30} projectSlug={slug} showSlotNumber={false} /><Placeholder number={31} projectSlug={slug} showSlotNumber={false} /></section>
        </>}
        </>}
      </RevealFlow>

      <section className="next-project"><p><Localized en="Next project" zh="下一个项目" /></p><Link href={`/work/${next.slug}`}><Localized en={next.titleEn ?? next.title} zh={next.title} /><span>↗</span></Link></section>
    </main>
  </>;
}
