const tags = ['Brand system', 'Digital product', '2026'];

function Media({ className = '', label }: { className?: string; label: string }) {
  return (
    <figure className={`media ${className}`}>
      <div className="media-mark" aria-hidden="true"><span /><span /><span /></div>
      <figcaption>{label} · replace with your image or video</figcaption>
    </figure>
  );
}

export default function Home() {
  return (
    <main>
      <header className="nav">
        <a className="wordmark" href="#top" aria-label="Portfolio home">Your Name<span>®</span></a>
        <nav aria-label="Main navigation">
          <a href="#work">Work</a><a href="#about">About</a><a href="mailto:hello@example.com">Contact</a>
        </nav>
      </header>
      <article id="top">
        <section className="hero" aria-labelledby="project-title">
          <p className="eyebrow">Featured project</p>
          <h1 id="project-title">A living identity for ideas still in motion.</h1>
          <div className="tags">{tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
        </section>
        <Media className="hero-media" label="Project cover" />
        <section className="story" id="about">
          <h2>Context</h2>
          <div><p className="lead">Turning a changing product into one clear, recognisable experience.</p>
          <p>This is placeholder copy for the background, problem and ambition of your project. The layout is ready for a concise case-study narrative and will expand naturally as you add real content.</p></div>
        </section>
        <section className="split" id="work"><Media label="Interface detail" /><Media label="System in use" /></section>
        <section className="story">
          <h2>Approach</h2>
          <div><p className="lead">A flexible system designed to hold together across every touchpoint.</p>
          <p>Use this section to describe your process, decisions and contribution. Replace the media blocks one by one without changing the surrounding composition.</p></div>
        </section>
        <Media className="wide warm" label="Full-width project moment" />
        <section className="story">
          <h2>Outcome</h2>
          <div><p className="lead">A confident foundation that can keep evolving.</p>
          <p>Close with the measurable result, what changed for the audience, and what you learned. The final rhythm deliberately gives the work room to breathe.</p></div>
        </section>
      </article>
      <footer>
        <p>Next project</p><a href="#top">Project Two <span aria-hidden="true">↗</span></a>
        <div className="footer-meta"><span>Portfolio · 2026</span><a href="mailto:hello@example.com">Let’s talk</a></div>
      </footer>
    </main>
  );
}
