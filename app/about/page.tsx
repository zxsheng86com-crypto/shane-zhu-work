import { Header } from '../site';
import { Localized } from '../localized';
import { HomeProjectPrefetch } from '../project-prefetch';

const experience = [
  {
    period: '2021 – Present',
    periodZh: '2021 – 至今',
    company: 'DJI',
    companyZh: '大疆创新',
    role: 'Senior UI Designer',
    roleZh: '高级 UI 设计师',
    details: [
      ['Innovation Business', 'Interface design for ROMO, AVINOX and DJI Power, extending one visual language across intelligent hardware and companion apps.'],
      ['Consumer Drones', 'Visual redesign for DJI Fly flight-control module 2.0, serving both professional pilots and new users across the product line.'],
      ['Handheld', 'Album experience redesign for DJI Mimo and brand identity design for DJI AURA cloud album service.'],
    ],
    detailsZh: [
      ['创新业务线', '负责 ROMO、AVINOX 与 DJI Power 等多品类硬件产品的界面设计，统一 App 与硬件的视觉语言。'],
      ['消费飞机业务线', '主导 DJI Fly 飞控模块 2.0 视觉重构升级，覆盖全系列机型。'],
      ['手持业务线', '负责 DJI Mimo App 相册模块重构升级，以及 DJI AURA 云相册品牌图形设计。'],
    ],
  },
  {
    period: '2019 – 2021',
    periodZh: '2019 – 2021',
    company: 'CVTE',
    companyZh: '视源股份',
    role: 'UI Designer · Education Hardware',
    roleZh: '教育硬件 UI 设计师',
    details: [['SEEWO', 'Led brand, interface and motion design for smart hardware products, plus the SEEWO HomeTime mini program and Education Cube web platform.']],
    detailsZh: [['希沃', '主导智能硬件产品的品牌、UI 与动效设计，以及希沃家时光小程序和教育魔方后台 Web 设计。']],
  },
  {
    period: '2018 – 2019',
    periodZh: '2018 – 2019',
    company: 'Tencent',
    companyZh: '腾讯科技',
    role: 'Visual Designer',
    roleZh: '视觉设计师',
    details: [['Tencent Medical Dictionary', 'Visual iteration for core modules across Tencent Medical Dictionary and Huiyongyao mini programs.']],
    detailsZh: [['腾讯医典', '负责腾讯医典、慧用药小程序多个核心模块的视觉改版与迭代。']],
  },
];

export default function About() {
  return <>
    <Header />
    <HomeProjectPrefetch />
    <main className="about-reference">
      <section className="about-intro about-reference-grid">
        <div className="about-reference-label"><Localized en="Introduction" zh="介绍" /></div>
        <h1><Localized en="I'm Shane Zhu, a UI designer with 8 years of experience focused on intelligent hardware GUI and cross-device mobile experiences. I have worked at Tencent, CVTE and DJI. I have led interface design for products across categories, including flight-control systems, robot-vacuum apps and E-bike displays, spanning device and mobile experiences while staying involved from concept exploration through design delivery and product release." zh="我是朱晓生。我有 8 年 UI 设计经验，专注智能硬件 GUI 与移动端跨端体验，先后任职腾讯、视源与大疆。主导过飞控系统、扫地机器人 App、E-bike 中控屏等多品类产品的界面设计，覆盖设备端与移动端体验，并持续参与项目从概念探索到设计落地与产品发布。" /></h1>
        <figure className="about-portrait">
          <div className="about-portrait-image">
            {/* ponytail: plain img — Next/Image + progressive JPEG was blanking on Safari */}
            <img
              src="/media/shane-zhu-avatar.jpg?v=20260930-baseline"
              alt="Shane Zhu"
              width={1593}
              height={1049}
              decoding="async"
              fetchPriority="high"
            />
          </div>
          <figcaption><Localized en="Shane Zhu" zh="朱晓生" /><br /><Localized en="Senior UI Designer · Shenzhen, CN" zh="高级 UI 设计师 · 中国深圳" /></figcaption>
        </figure>
      </section>

      <section className="about-reference-table-section about-reference-experience about-reference-grid">
        <div className="about-reference-label"><Localized en="Experience" zh="工作经历" /></div>
        <div className="about-reference-table">
          {experience.map((item) => <article className="about-reference-row about-reference-experience-row" key={item.company}>
            <p className="about-reference-period"><Localized en={item.period} zh={item.periodZh} /></p>
            <div className="about-reference-company"><h3><Localized en={item.company} zh={item.companyZh} /></h3><p><Localized en={item.role} zh={item.roleZh} /></p></div>
            <div className="about-reference-detail">
              <div className="lang-en">{item.details.map(([label, text]) => <div key={label}><h4>{label}</h4><p>{text}</p></div>)}</div>
              <div className="lang-zh">{item.detailsZh.map(([label, text]) => <div key={label}><h4>{label}</h4><p>{text}</p></div>)}</div>
            </div>
          </article>)}
        </div>
      </section>

      <section className="about-reference-table-section about-reference-grid">
        <div className="about-reference-label"><Localized en="Education" zh="教育背景" /></div>
        <div className="about-reference-table">
          <article className="about-reference-row about-reference-education-row">
            <p className="about-reference-period">2014 – 2018</p>
            <div className="about-reference-company"><h3><Localized en="Shantou University" zh="汕头大学" /></h3><p><Localized en="Digital Media Arts · Interaction Design" zh="数字多媒体艺术 · 交互方向" /></p></div>
          </article>
        </div>
      </section>

      <section className="about-reference-table-section about-reference-grid">
        <div className="about-reference-label"><Localized en="Contact" zh="联系方式" /></div>
        <div className="about-reference-table">
          <a className="about-reference-row about-reference-contact-row" href="tel:+8613232762061"><p>Phone</p><p>+86 132 3276 2061</p><span aria-hidden="true">↗</span></a>
          <a className="about-reference-row about-reference-contact-row" href="mailto:825921813@qq.com"><p>E-mail</p><p>825921813@qq.com</p><span aria-hidden="true">↗</span></a>
          <a className="about-reference-row about-reference-contact-row" href="/朱晓生简历.pdf" target="_blank" rel="noreferrer"><p><Localized en="Résumé" zh="简历" /></p><p><Localized en="Open PDF" zh="打开 PDF" /></p><span aria-hidden="true">↗</span></a>
        </div>
      </section>
    </main>
  </>;
}
