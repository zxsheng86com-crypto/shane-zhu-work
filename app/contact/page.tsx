import Link from 'next/link'; import { Header } from '../site';
export default function Contact(){return <><Header/><main className="contact-page"><p>Have a project in mind?</p><h1>Let’s make it<br/>clear together.</h1><a href="mailto:hello@example.com">hello@example.com ↗</a><div><span>Shanghai / Remote</span><Link href="/">Back home</Link></div></main></>}
