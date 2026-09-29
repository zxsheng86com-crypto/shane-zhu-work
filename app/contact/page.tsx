import Link from 'next/link'; import { Header } from '../site';
import { Localized } from '../localized';
export default function Contact(){return <><Header/><main className="contact-page"><p><Localized en="Have a project in mind?" zh="有项目想法？" /></p><h1><Localized en={<>Let’s make it<br/>clear together.</>} zh={<>让我们一起<br/>把它做清楚。</>} /></h1><a href="mailto:hello@example.com">hello@example.com ↗</a><div><span>Shanghai / Remote</span><Link href="/"><Localized en="Back home" zh="返回首页" /></Link></div></main></>}
