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

function Story({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return <section className={`case-text ${title.toLowerCase()}`}><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><p>{children}</p></section>;
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
        <Story title={slug === 'common-ground' ? '设计策略' : '挑战'} subtitle={slug === 'common-ground' ? '建立品类差异，统一软硬件体验' : undefined}>{slug === 'common-ground' ? 'ROMO 作为后进入者，需要摆脱成熟品类中趋同的界面表达，建立清晰、可识别的产品气质；同时，透明 ID 将内部精密结构直接呈现给用户，软件也需要延续这一硬件特征。基于这两点，UI 以结构可视化和功能动效建立差异，并通过克制的色彩、排版与留白，让设备与 App 形成统一的视觉体验。' : description}</Story>
        <section className="media-block"><Placeholder number={2} projectSlug={slug} /></section>

        <Story title="APP ICON" subtitle={slug === 'common-ground' ? '把清洁轨迹变成品牌符号' : undefined}>{slug === 'common-ground' ? '提取扫地机器人运行中的扩散与吸入动作，将动态轨迹转化为图形语言。Icon 不直接描绘设备外形，而是用产品特有的工作方式建立识别，在保持简洁的同时形成 ROMO 独有的科技感。' : description}</Story>
        <section className="media-block media-pair"><Placeholder number={3} projectSlug={slug} /><Placeholder number={4} projectSlug={slug} /></section>

        <Story title="HOME PAGE" subtitle={slug === 'common-ground' ? '以简驭繁，让设备状态直观可见' : undefined}>{slug === 'common-ground' ? '同类产品的首页通常以白底静态设备图呈现，设备图本身不承载状态信息。ROMO 的透明 ID 具有精密而复杂的结构，因此首页以精细的设备动态效果作为视觉核心，UI 则保持克制、直白，以简洁界面衬托硬件细节。设备图会随运行状态实时变化，用户无需进入二级页面即可直观看见设备正在做什么，也让每次打开 App 都能获得鲜活、可感知的状态反馈。' : description}</Story>
        <section className="media-block media-pair"><Placeholder number={5} projectSlug={slug} /><Placeholder number={6} projectSlug={slug} /></section>
        <section className="media-block"><Placeholder number={7} projectSlug={slug} /></section>
        <section className="media-block"><Placeholder number={8} projectSlug={slug} /></section>

        <Story title="小组件" subtitle={slug === 'common-ground' ? '把高频状态带到系统桌面' : undefined}>{slug === 'common-ground' ? '小组件延续首页的机械刻度与结构语言，把设备状态、清洁进度和常用操作前置到系统桌面，减少进入 App 和层级跳转。' : description}</Story>
        <section className="media-block"><Placeholder number={9} projectSlug={slug} /></section>

        <Story title={slug === 'common-ground' ? '状态反馈' : '定时清洁'} subtitle={slug === 'common-ground' ? '让任务来源一眼可知' : undefined}>{slug === 'common-ground' ? '定时计划触发时，首页闹钟图标以专属动效进入执行状态，区别于手动清洁，让用户直接知道设备正在执行哪类任务。连续的状态过渡也让任务从触发到执行衔接得更加自然。' : description}</Story>
        <section className="media-block media-stack reverse"><div><Placeholder number={10} projectSlug={slug} /><Placeholder number={11} projectSlug={slug} /></div><Placeholder number={12} projectSlug={slug} /></section>

        <Story title="基站功能" subtitle={slug === 'common-ground' ? '让耗材状态可见，让部件动效可复用' : undefined}>{slug === 'common-ground' ? '基站入口以透明化结构呈现尘袋、拖布等耗材状态，剩余寿命随使用实时变化，并在临近耗尽时转为红色提示。执行基站任务时，入口通过强化动效明确当前状态。弹窗动效聚焦拖布、尘袋等局部部件，而非绑定整机外观，使同一套表达能够适配不同设备结构和后续产品迭代。' : description}</Story>
        <section className="media-block"><Placeholder number={13} projectSlug={slug} /></section>
        <section className="media-block media-pair"><Placeholder number={14} projectSlug={slug} /><Placeholder number={15} projectSlug={slug} /></section>
        <section className="media-block"><Placeholder number={16} projectSlug={slug} /></section>

        <Story title="地图设计" subtitle={slug === 'common-ground' ? '弱化无效色彩，突出路径、状态与操作' : undefined}>{slug === 'common-ground' ? '同类产品通常使用多种色块区分房间，但有限的颜色会被重复使用，并不能稳定表达房间之间的真实关系。ROMO 在保留区域识别的基础上弱化装饰性色彩，将视觉重点留给设备路径、工作状态和地图编辑操作，使复杂操作更清晰，也与透明硬件的整体调性保持一致。' : description}</Story>
        <section className="media-block"><Placeholder number={17} projectSlug={slug} /></section>
        <section className="media-block media-pair"><Placeholder number={18} projectSlug={slug} /><Placeholder number={19} projectSlug={slug} /></section>

        <Story title="清洁模式设置" subtitle={slug === 'common-ground' ? '用两类控件统一复杂参数' : undefined}>{slug === 'common-ground' ? '清洁参数采用“左侧信息、右侧控件”的统一结构，并根据操作特征收敛为点按与滑动两种类型。用户可以沿用同一套操作方式，后续新增参数也不需要改变页面结构。' : description}</Story>
        <section className="media-block media-pair"><Placeholder number={20} projectSlug={slug} /><Placeholder number={21} projectSlug={slug} /></section>

        <Story title="添加设备" subtitle={slug === 'common-ground' ? '让配网过程始终有反馈' : undefined}>{slug === 'common-ground' ? '配网过程通过连续动效呈现当前步骤、连接进度和设备状态，让用户始终知道系统正在执行什么，也让等待过程保持连贯。' : description}</Story>
        <section className="media-block"><Placeholder number={22} projectSlug={slug} /></section>

        <Story title="远程视频监控" subtitle={slug === 'common-ground' ? '画面优先，操作随用随现' : undefined}>{slug === 'common-ground' ? '远程监控采用沉浸式全屏预览，将双向语音、巡航等操作收拢至画面边缘，避免控件持续遮挡核心内容。操作根据使用状态出现，在保证画面完整的同时，让高频功能保持快速可达。' : description}</Story>
        <section className="media-block"><Placeholder number={23} projectSlug={slug} /></section>

        <Story title={slug === 'common-ground' ? '设备设置与场景' : '设备设置'} subtitle={slug === 'common-ground' ? '用可视化解释设备如何工作' : undefined}>{slug === 'common-ground' ? '宠物模式、地毯模式等设置涉及设备内部运行逻辑，仅靠文字很难理解。设备动效和状态图形直接演示模式变化，把抽象参数转化为可以看到的运行结果。' : description}</Story>
        <section className="media-block media-stack reverse"><div><Placeholder number={24} projectSlug={slug} /><Placeholder number={25} projectSlug={slug} /></div><Placeholder number={26} projectSlug={slug} /></section>
        <section className="media-block"><Placeholder number={27} projectSlug={slug} /></section>
        <section className="media-block"><Placeholder number={28} projectSlug={slug} /></section>
        </>}
      </RevealFlow>

      <section className="next-project"><p>Next project</p><Link href={`/work/${next.slug}`}>{next.title}<span>↗</span></Link></section>
    </main>
  </>;
}
