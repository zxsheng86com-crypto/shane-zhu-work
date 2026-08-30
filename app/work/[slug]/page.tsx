import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header, projects } from '../../site';
import { RevealFlow } from './reveal-flow';
import { ViewportVideo } from './viewport-video';

export function generateStaticParams() {
  return projects.map(({ slug }) => ({ slug }));
}

const romoSlots = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28]);
const romoVideos = new Set([2, 5, 6, 8, 9, 10, 11, 12, 13, 16, 17, 18, 19, 20, 21, 24, 27]);
const avinoxSlots = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31]);
const avinoxVideos = new Set([2, 6, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 23, 24, 25, 30]);
const powerSlots = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
const powerVideos = new Set<number>();

function Placeholder({ number, projectSlug, tone = 'dark' }: { number: number; projectSlug: string; tone?: string }) {
  const media = projectSlug === 'common-ground'
    ? { folder: 'dji-romo', slots: romoSlots, videos: romoVideos }
    : projectSlug === 'dji-avinox'
      ? { folder: 'dji-avinox', slots: avinoxSlots, videos: avinoxVideos }
      : projectSlug === 'dji-power'
        ? { folder: 'dji-power', slots: powerSlots, videos: powerVideos }
        : undefined;
  const src = media?.slots.has(number) ? `/media/${media.folder}/${String(number).padStart(2, '0')}.${media.videos.has(number) ? 'mp4' : 'png'}` : undefined;
  return <figure className={`placeholder ${tone}${src ? ' has-media' : ''}`}>
    {src && (media?.videos.has(number) ? <ViewportVideo src={src} /> : <img src={src} alt="" loading={number === 1 ? 'eager' : 'lazy'} draggable={false} data-pin-nopin="true" />)}
    <strong className="slot-number">{String(number).padStart(2, '0')}</strong>
  </figure>;
}

function Story({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className={`case-text ${title.toLowerCase()}`}><div><h2>{title}</h2></div><p>{children}</p></section>;
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
    <main className="case-study">
      <header className="case-hero">
        <div><p>{project.title}</p><h1>{project.text}</h1></div>
        <div className="tags">{(project.tags ?? [project.type, project.year, 'Selected work']).map((tag, tagIndex) => <span key={`${tag}-${tagIndex}`}>{tag}</span>)}</div>
      </header>

      <Placeholder number={1} projectSlug={slug} tone={project.color} />

      <RevealFlow>
        {slug === 'dji-avinox' ? <>
          <Story title="LOGO">AVINOX 的 Logo 基于 DJI 品牌字体 DJI Font 进行设计，通过对字形结构的视觉平衡与调整，使整体更加紧凑，具备独立品牌标识的识别感。</Story>
          <section className="media-block"><Placeholder number={2} projectSlug={slug} /></section>

          <Story title="字体设计">作为一款面向运动骑行场景的产品，车屏字体需要传递出运动感与速度感。基于多次骑行测试中用户对倾斜角度的偏好反馈，字体设计上采用了 12° 倾斜处理，通过字体的动态姿态强化产品的运动属性，使其视觉气质与电助力山地骑行的场景调性一致。</Story>
          <section className="media-block"><Placeholder number={3} projectSlug={slug} /></section>
          <section className="media-block"><Placeholder number={4} projectSlug={slug} /></section>

          <Story title="挑战">AVINOX 中控屏采用 2 英寸 OLED 屏幕，但与手表、手持设备等传统小屏产品不同，它被固定在车架上，用户无法自由调整观看距离和角度。骑行过程中人眼与屏幕的距离相对固定约在 50 厘米左右，且屏幕位置处于车架中下部，偏离人眼自然舒适视区。在户外强光、颠簸骑行等复杂环境下，如何确保屏幕信息的可读性，是设计面临的核心挑战。</Story>
          <section className="media-block media-pair"><Placeholder number={5} projectSlug={slug} /><Placeholder number={6} projectSlug={slug} /></section>

          <Story title="设计策略">基于上述硬件与场景挑战，经过多次户外骑行测试，结合整体产品目标定义了以下 3 项设计原则：1 · 字号分级，区分非骑行状态与骑行状态两种场景，分别定义对应的字号规范，确保不同状态下信息的可读性。2 · 信息密度控制，骑行场景下单屏最多展示 3 个数据项，避免信息过载，确保骑手能够快速捕捉关键信息。3 · 图形化辅助，通过 Icon 与图形化表达强化视觉重点，辅助骑手在高速运动中快速理解信息。</Story>
          <section className="media-block"><Placeholder number={7} projectSlug={slug} /></section>
          <section className="media-block"><Placeholder number={8} projectSlug={slug} /></section>

          <Story title="信息框架策略">基于人眼从上至下的自然浏览习惯，定义了车屏两种布局框架，兼顾多种数据类型的展示，丰富骑手的骑行场景体验。同时新增了不同维度的图形可视化呈现，辅助用户在骑行过程中更直观、高效地获取数据变化。</Story>
          <section className="media-block"><Placeholder number={9} projectSlug={slug} /></section>
          <section className="media-block media-pair"><Placeholder number={10} projectSlug={slug} /><Placeholder number={11} projectSlug={slug} /></section>

          <Story title="运动数据">在运动数据设计上，对多项骑行数据设计了 Icon。在多语言适配文本溢出的问题上，市面通行做法是采用文本滚动处理。但在骑行场景中运动数值是实时变化的，滚动文本会干扰用户对数值的读取。因此我们将部分文本信息简化并合并至 Icon 中，从源头减少多语言溢出压力，让用户更专注于骑行数值本身。</Story>
          <section className="media-block"><Placeholder number={12} projectSlug={slug} /></section>
          <section className="media-block media-pair"><Placeholder number={13} projectSlug={slug} /><Placeholder number={14} projectSlug={slug} /></section>

          <Story title="Boost 模式">Boost 模式是为了体现电机强劲的动力性能。采用从中心向外发射的线条动效，以传达速度与力量感，提升品牌调性和质感，并强化 Boost 功能本身的性能感知。</Story>
          <section className="media-block"><Placeholder number={15} projectSlug={slug} /></section>

          <Story title="下拉控制中心">下拉控制中心经历了多轮需求变更与测试验证，最终与项目达成共识：小屏信息应直观、高效。设计上删减了冗余的模块名称和设置项，提升小屏上的信息获取效率。最终方案采用统一布局结构，即使在没有标题的情况下，用户也能高效、直观地区分各个功能模块。</Story>
          <section className="media-block"><Placeholder number={16} projectSlug={slug} /></section>

          <Story title="推车模式">推车模式为骑手在陡坡场景下提供电助力，减轻推车压力，同时支持在陡坡中抬起后轮快速切换变速档位。经过多轮外测骑行测试与需求调整，最终确认了功能与图形相结合的可视化方案：触发推车模式后，屏幕实时显示当前坡度情况，用户可据此判断是否需要换挡变速。快速变档部分提供了齿轮换挡的可视化设计，图形与数值的联动变化提升了复杂环境下的信息获取效率。</Story>
          <section className="media-block media-stack reverse"><div><Placeholder number={17} projectSlug={slug} /><Placeholder number={18} projectSlug={slug} /></div><Placeholder number={19} projectSlug={slug} /></section>
          <section className="media-block"><Placeholder number={20} projectSlug={slug} /></section>

          <Story title="APP ICON">AVINOX APP ICON 以字母标识为基础，为避免视觉单调，从 Boost 模式的速度感线条中提取灵感，使其在众多应用图标中具备快速识别性与差异化。</Story>
          <section className="media-block media-pair"><Placeholder number={21} projectSlug={slug} /><Placeholder number={22} projectSlug={slug} /></section>

          <Story title="APP 首页设计">APP 首页围绕“专注、高效、易用”的设计策略展开，整体与车屏视觉风格保持一致，采用深色调性，通过提升色彩识别度让信息更易读取、阅读更舒适。首页以功能和服务为导向，强调信息获取的直接性与操作的简洁性。</Story>
          <section className="media-block"><Placeholder number={23} projectSlug={slug} /></section>
          <section className="media-block media-pair"><Placeholder number={24} projectSlug={slug} /><Placeholder number={25} projectSlug={slug} /></section>

          <Story title="导航功能">AVINOX 的导航功能定位为离线导航，区别于市面常见的在线导航方案。用户通过下载专业骑行路线文件，上传至手机后发送至中控屏，即可在无网络覆盖的户外骑行环境中使用导航功能。</Story>
          <section className="media-block media-pair"><Placeholder number={26} projectSlug={slug} /><Placeholder number={27} projectSlug={slug} /></section>

          <Story title="运动数据">APP 运动数据页同样以高效、直观为设计原则，满足用户在骑行过程中查看数据变化的需求。在车屏联动方面，APP 支持快捷自定义中控屏的显示内容，用户可自由编辑数据的数量与类型，使车屏信息更贴合个人骑行习惯，操作更加直观。</Story>
          <section className="media-block"><Placeholder number={28} projectSlug={slug} /></section>

          <Story title="车屏设置">在车屏的控制上，APP 可以快捷地自定义中控屏的显示内容，编辑数据的数量和数据类型，让整个操作更加直观。</Story>
          <section className="media-block"><Placeholder number={29} projectSlug={slug} /></section>
          <section className="media-block"><Placeholder number={30} projectSlug={slug} /></section>
          <section className="media-block"><Placeholder number={31} projectSlug={slug} /></section>
        </> : slug === 'dji-power' ? <>
          <Story title="字体设计">断码字体的设计上，通过提炼 DJI Logo 的倾斜与弧度作为视觉锤，针对 Logo 原始 15° 倾斜角在固定尺寸断码屏上导致字符过宽、信息密度不足的问题，将倾斜角度优化至 7.5°，在延续品牌气质的前提下，大幅提升信息展示的紧凑度与效率。</Story>
          <section className="media-block"><Placeholder number={2} projectSlug={slug} /></section>
          <section className="media-block"><Placeholder number={3} projectSlug={slug} /></section>

          <Story title="字号 & 颜色规范">基于断码屏特殊的硬件显示机制，定义了 4 种基础字号层级，在满足硬件识别特性的前提下，建立起严谨的信息阅读秩序。在色彩体系上，从产品硬件 ID 的接口橙色中提取灵感，确立为主题色。确保了跨媒介的色彩一致性，更将硬件的工业质感延伸至屏幕界面，强化了产品的整体感。</Story>
          <section className="media-block media-pair"><Placeholder number={4} projectSlug={slug} /><Placeholder number={5} projectSlug={slug} /></section>

          <Story title="图形设计">摒弃繁复的装饰，采用极简且高辨识度的图形语言。这不仅契合大疆克制、专业的品牌气质，更确保了在低分辨率的断码屏上，用户能够以最低的认知成本瞬间获取信息。</Story>
          <section className="media-block media-pair"><Placeholder number={6} projectSlug={slug} /><Placeholder number={7} projectSlug={slug} /></section>

          <Story title="布局设计">整体界面采用稳定、简约的布局结构进行内容划分。确保在切换不同显示内容时，视觉重心始终保持居中与平衡，给用户提供了清晰、稳定的视觉体验。</Story>
          <section className="media-block media-pair"><Placeholder number={8} projectSlug={slug} /><Placeholder number={9} projectSlug={slug} /></section>
          <section className="media-block"><Placeholder number={10} projectSlug={slug} /></section>
          <section className="media-block"><Placeholder number={11} projectSlug={slug} /></section>

          <Story title="其他断码设计">随着大疆储能产品线的快速迭代，不同功能定位与尺寸规格的储能电源相继推出。基于前期建立的核心断码屏设计系统（字号、色彩、布局规范），实现了跨产品线的视觉统一与高效延展，确保了大疆储能家族在用户认知上的高度一致性。</Story>
          <section className="media-block media-pair"><Placeholder number={12} projectSlug={slug} /><Placeholder number={13} projectSlug={slug} /></section>
          <section className="media-block"><Placeholder number={14} projectSlug={slug} /></section>
          <section className="media-block media-pair"><Placeholder number={15} projectSlug={slug} /><Placeholder number={16} projectSlug={slug} /></section>
          <section className="media-block"><Placeholder number={17} projectSlug={slug} /></section>
        </> : <>
        <Story title={slug === 'common-ground' ? '设计策略：以简驭繁' : '挑战'}>{slug === 'common-ground' ? 'ROMO 采用透明机身，将内部结构与精密部件直接呈现给用户。基于这一产品特征，UI 将“结构可视化”确立为核心设计语言：以设备内部结构作为视觉锚点，并延伸至 App 的功能表达中。界面则通过克制的色彩、排版与留白降低视觉干扰，以简洁的 UI 衬托产品结构的精密感，在硬件与数字体验之间建立一致的品牌表达。' : description}</Story>
        <section className="media-block"><Placeholder number={2} projectSlug={slug} /></section>

        <Story title="APP ICON">{slug === 'common-ground' ? '从扫地机器人清洁过程中的“扩散与吸入”动作中提取运动轨迹，并将其抽象为图形语言，使图标既能关联产品功能，也具备独立的识别特征。' : description}</Story>
        <section className="media-block media-pair"><Placeholder number={3} projectSlug={slug} /><Placeholder number={4} projectSlug={slug} /></section>

        <Story title="HOME PAGE">{slug === 'common-ground' ? '首页延续“结构可视化”的设计语言，将基站状态与清洁过程转化为实时动效，使设备状态能够被直接感知。为适配不同产品型号，视觉内容采用设备、动效、UI 与背景的分层结构。开发时可根据不同型号替换对应素材，提升后续适配与维护效率。' : description}</Story>
        <section className="media-block media-pair"><Placeholder number={5} projectSlug={slug} /><Placeholder number={6} projectSlug={slug} /></section>
        <section className="media-block"><Placeholder number={7} projectSlug={slug} /></section>
        <section className="media-block"><Placeholder number={8} projectSlug={slug} /></section>

        <Story title="小组件">{slug === 'common-ground' ? '桌面小组件延续首页的机械刻度语言，让用户无需进入 App，即可快速查看设备状态与清洁进度。' : description}</Story>
        <section className="media-block"><Placeholder number={9} projectSlug={slug} /></section>

        <Story title={slug === 'common-ground' ? '状态反馈' : '定时清洁'}>{slug === 'common-ground' ? '针对定时清洁等高频场景，在任务触发时通过闹钟图标的状态动效提供即时反馈，帮助用户确认任务已经启动。' : description}</Story>
        <section className="media-block media-stack reverse"><div><Placeholder number={10} projectSlug={slug} /><Placeholder number={11} projectSlug={slug} /></div><Placeholder number={12} projectSlug={slug} /></section>

        <Story title="基站功能">{slug === 'common-ground' ? '将基站的多项功能整合进可展开、收拢的面板结构，通过局部放大与部件映射，建立功能与实体部件之间的对应关系。模块化的动效结构能够适配后续功能与设备变化，降低新增功能对整体界面的影响。' : description}</Story>
        <section className="media-block"><Placeholder number={13} projectSlug={slug} /></section>
        <section className="media-block media-pair"><Placeholder number={14} projectSlug={slug} /><Placeholder number={15} projectSlug={slug} /></section>
        <section className="media-block"><Placeholder number={16} projectSlug={slug} /></section>

        <Story title="地图设计">{slug === 'common-ground' ? '区别于竞品常见的大面积色块方案，地图采用更克制的色彩与信息层级，减少视觉干扰，突出清洁区域、设备位置与任务状态。同时为家具、禁区和门槛等地图元素建立统一的编辑规则，使复杂地图操作保持清晰、一致。' : description}</Story>
        <section className="media-block"><Placeholder number={17} projectSlug={slug} /></section>
        <section className="media-block media-pair"><Placeholder number={18} projectSlug={slug} /><Placeholder number={19} projectSlug={slug} /></section>

        <Story title="清洁模式设置">{slug === 'common-ground' ? '采用“左侧信息、右侧控件”的布局方式，并根据参数特征定义点按与滑动两类交互方式，使更多清洁参数能够在统一结构中扩展。状态切换通过连续的过渡动效建立视觉关联，帮助用户理解设置前后的变化。' : description}</Story>
        <section className="media-block media-pair"><Placeholder number={20} projectSlug={slug} /><Placeholder number={21} projectSlug={slug} /></section>

        <Story title="添加设备">{slug === 'common-ground' ? '通过清晰的步骤引导与状态动效呈现配网进度，降低等待过程中的不确定感，并保持整体体验与 ROMO 视觉语言的一致性。' : description}</Story>
        <section className="media-block"><Placeholder number={22} projectSlug={slug} /></section>

        <Story title="远程视频监控">{slug === 'common-ground' ? '采用沉浸式全屏预览，将语音、巡航等操作收纳至画面边缘，减少控件对核心视频内容的遮挡。通过清晰的控制层级与状态反馈，让用户能够快速完成查看、通话和设备控制。' : description}</Story>
        <section className="media-block"><Placeholder number={23} projectSlug={slug} /></section>

        <Story title={slug === 'common-ground' ? '设备设置与场景' : '设备设置'}>{slug === 'common-ground' ? '将抽象参数转化为可感知的图形与动效。例如在宠物模式和地毯模式中，通过设备状态演示解释功能的运行与识别逻辑。配合统一的图标系统与交互结构，降低用户理解复杂设置的成本。' : description}</Story>
        <section className="media-block media-stack reverse"><div><Placeholder number={24} projectSlug={slug} /><Placeholder number={25} projectSlug={slug} /></div><Placeholder number={26} projectSlug={slug} /></section>
        <section className="media-block"><Placeholder number={27} projectSlug={slug} /></section>
        <section className="media-block"><Placeholder number={28} projectSlug={slug} /></section>
        </>}
      </RevealFlow>

      <section className="next-project"><p>Next project</p><Link href={`/work/${next.slug}`}>{next.title}<span>↗</span></Link></section>
    </main>
  </>;
}
