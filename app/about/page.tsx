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
      ['', 'Independently led UI design for products across multiple categories, including DJI ROMO (robot vacuum), AVINOX (electric-assist mountain bike system) and DJI Power (portable power station), and led the visual redesign of DJI Fly flight-control module 2.0.'],
    ],
    detailsZh: [
      ['', '独立负责多品类产品的 UI 设计，涵盖 DJI ROMO（扫地机器人）、AVINOX（电助力山地自行车系统）、DJI Power（户外电源）等创新项目，并主导 DJI Fly 飞控模块 2.0 的视觉升级。'],
    ],
  },
  {
    period: '2019 – 2021',
    periodZh: '2019 – 2021',
    company: 'CVTE',
    companyZh: '视源股份',
    role: 'UI Designer',
    roleZh: 'UI设计师',
    details: [['', 'Led brand, UI and motion design for SEEWO projects, including the Cloud Screen mini program and Education Cube web platform.']],
    detailsZh: [['', '主导希沃相关项目的品牌、UI 与动效设计，并负责希沃云屏小程序及教育魔方后台 Web 设计。']],
  },
  {
    period: '2018 – 2019',
    periodZh: '2018 – 2019',
    company: 'Tencent',
    companyZh: '腾讯科技',
    role: 'Visual Designer',
    roleZh: '视觉设计师',
    details: [['', 'Visual iteration for core modules across Tencent Medical Dictionary and Huiyongyao mini programs.']],
    detailsZh: [['', '负责腾讯医典、慧用药小程序多个核心模块的视觉改版与迭代。']],
  },
];

export default function About() {
  return <>
    <Header />
    <HomeProjectPrefetch />
    <main className="about-reference">
      <section className="about-intro about-reference-grid">
        <div className="about-reference-label"><Localized en="Introduction" zh="介绍" /></div>
        <h1><Localized en="I’m Shane Zhu, a UI designer with 8 years of experience in intelligent hardware and cross-device design. At Tencent, CVTE and DJI, I’ve led interfaces for flight-control systems, robot-vacuum apps and E-bike displays, from concept to launch." zh="我是朱晓生。我有 8 年 UI 设计经验，专注智能硬件 GUI 与移动端跨端体验，先后任职腾讯、视源与大疆。主导过飞控系统、扫地机器人 App、E-bike 中控屏等多品类产品的界面设计，覆盖设备端与移动端体验，并持续参与项目从概念探索到设计落地与产品发布。" /></h1>
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
              data-pin-nopin="true"
              data-pin-no-hover="true"
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
              <div className="lang-en">{item.details.map(([label, text]) => <div key={label || text}>{label && <h4>{label}</h4>}<p>{text}</p></div>)}</div>
              <div className="lang-zh">{item.detailsZh.map(([label, text]) => <div key={label || text}>{label && <h4>{label}</h4>}<p>{text}</p></div>)}</div>
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
        </div>
      </section>
    </main>
  </>;
}
