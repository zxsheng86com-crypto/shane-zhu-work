import { Footer, Header, PageIntro } from '../site';
const news=[['25.08.26','Portfolio framework launches in its first working form.'],['14.06.26','New identity project selected for an autumn release.'],['02.03.26','Available for one new collaboration this quarter.']];
export default function News(){return <><Header/><main><PageIntro label="News" title="Recent changes, releases and studio notes."/><div className="news-list">{news.map(([date,text])=><article key={date}><time>{date}</time><h2>{text}</h2></article>)}</div></main><Footer/></>}
