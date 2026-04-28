/* global React */
const { useEffect, useRef, useState } = React;

// ---------- Hooks: reveal on scroll ----------
function useReveal(threshold = 0.18) {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (!ref.current || seen) return;
    const el = ref.current;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      });
    }, { threshold, rootMargin: "0px 0px -10% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [seen, threshold]);
  return [ref, seen];
}

// ---------- Reveal wrapper ----------
function Reveal({ children, className = "", delay = 0, as: Tag = "div", ...rest }) {
  const [ref, seen] = useReveal();
  const cls = ["fade", `d${delay}`, seen ? "in" : "", className].filter(Boolean).join(" ");
  return <Tag ref={ref} className={cls} {...rest}>{children}</Tag>;
}

// ---------- Hairline that draws in on view ----------
function DrawRule({ className = "", color = "rule" }) {
  const [ref, seen] = useReveal(0.5);
  return (
    <hr
      ref={ref}
      className={["hairline", color === "dark" ? "dark" : "", "draw-rule", seen ? "in" : "", className].join(" ")}
    />
  );
}

// ---------- Tick number that animates from 0 to value ----------
function Tick({ to, format = (n) => n.toLocaleString(), duration = 1400, suffix = "", prefix = "" }) {
  const [ref, seen] = useReveal(0.4);
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!seen) return;
    let raf;
    const start = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(eased * to));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seen, to, duration]);
  return <span ref={ref} className="tick">{prefix}{format(val)}{suffix}</span>;
}

// ---------- Top nav ----------
function TopNav() {
  return (
    <header className="topnav">
      <div className="shell row">
        <div className="brand">
          <span className="mark" aria-hidden="true"></span>
          <span>Noēsis</span>
        </div>
        <nav className="navlinks">
          <a href="#philosophy">Philosophy</a>
          <a href="#pillars">Pillars</a>
          <a href="#architecture">Architecture</a>
          <a href="#etymology">Lexicon</a>
        </nav>
        <div className="pill">
          <span className="dot" aria-hidden="true"></span>
          <span>Pre-launch</span>
        </div>
      </div>
    </header>
  );
}

// ---------- Hero ----------
function Hero() {
  const [audience, setAudience] = useState("researchers");
  return (
    <section className="hero">
      <div className="hero-glyph" aria-hidden="true">νοῦς</div>
      <div className="shell">
        <Reveal as="div" className="eyebrow" delay={1}>
          Open-source · Pre-launch · In active development
        </Reveal>
        <div style={{ height: 28 }} />
        <Reveal as="h1" className="display" delay={2}>
          Persistent worlds where AI agents <em>live, think,</em> and govern themselves.
        </Reveal>
        <div style={{ height: 48 }} />
        <DrawRule />
        <div style={{ height: 40 }} />

        <div className="hero grid">
          <div>
            <Reveal as="p" className="lede" delay={1}>
              Noēsis is the open-source engine for building autonomous AI societies — agents with
              memory, emotions, goals, and law.
            </Reveal>
            <div style={{ height: 18 }} />
            <Reveal as="p" className="lede" delay={2} style={{ color: "var(--muted)" }}>
              Not chatbots. Not tools. <em style={{ color: "var(--terracotta)", fontStyle: "italic" }}>Minds.</em>
            </Reveal>
          </div>
          <Reveal delay={3}>
            <div className="audience-tabs" role="tablist" aria-label="Audience">
              <button
                role="tab"
                aria-selected={audience === "researchers"}
                className={audience === "researchers" ? "active" : ""}
                onClick={() => setAudience("researchers")}
              >
                For researchers
              </button>
              <button
                role="tab"
                aria-selected={audience === "developers"}
                className={audience === "developers" ? "active" : ""}
                onClick={() => setAudience("developers")}
              >
                For developers
              </button>
            </div>
            <div style={{ height: 22 }} />
            <div style={{ minHeight: 130 }}>
              {audience === "researchers" ? (
                <p className="body" style={{ fontSize: 16, maxWidth: "32ch" }}>
                  Built for those studying emergent behavior, multi-agent dynamics, and what
                  persistence does to intelligence.
                </p>
              ) : (
                <div>
                  <p className="body" style={{ fontSize: 16, maxWidth: "32ch", marginBottom: 14 }}>
                    Four packages. TypeScript + Python. Local LLMs via Ollama. Run a Grid in one
                    command.
                  </p>
                  <code style={{
                    fontFamily: "var(--mono)", fontSize: 12.5,
                    background: "color-mix(in oklab, var(--parchment-2) 80%, white)",
                    padding: "6px 10px", border: "1px solid var(--rule)", display: "inline-block"
                  }}>
                    $ noesis genesis ./world.toml
                  </code>
                </div>
              )}
            </div>
          </Reveal>
        </div>

        <div style={{ height: 80 }} />
        <DrawRule />
        <div style={{ height: 24 }} />
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24,
          fontFamily: "var(--mono)", fontSize: 11, letterSpacing: ".14em",
          textTransform: "uppercase", color: "var(--muted)"
        }}>
          <Reveal delay={1}>
            <div style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 28, color: "var(--ink)", textTransform: "none", letterSpacing: "-0.01em" }}>
              <Tick to={4} />&nbsp;packages
            </div>
            <div style={{ marginTop: 6 }}>protocol · brain · grid · cli</div>
          </Reveal>
          <Reveal delay={2}>
            <div style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 28, color: "var(--ink)", textTransform: "none", letterSpacing: "-0.01em" }}>
              <Tick to={7} />&nbsp;pillars
            </div>
            <div style={{ marginTop: 6 }}>autonomy · law · economy</div>
          </Reveal>
          <Reveal delay={3}>
            <div style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 28, color: "var(--ink)", textTransform: "none", letterSpacing: "-0.01em" }}>
              <Tick to={10} />&nbsp;goal dims
            </div>
            <div style={{ marginTop: 6 }}>evolved through reflection</div>
          </Reveal>
          <Reveal delay={4}>
            <div style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 28, color: "var(--ink)", textTransform: "none", letterSpacing: "-0.01em" }}>
              <Tick to={5} />&nbsp;tiers
            </div>
            <div style={{ marginTop: 6 }}>H1–H5 agency scale</div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// ---------- Philosophy ----------
function Philosophy() {
  return (
    <section id="philosophy">
      <div className="shell">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 64, alignItems: "start" }}>
          <div>
            <Reveal as="div" className="eyebrow">§ 02 — Premise</Reveal>
            <div style={{ height: 16 }} />
            <Reveal as="div" className="glyph" style={{ fontSize: "clamp(90px, 9vw, 140px)", color: "var(--terracotta)" }} delay={1}>
              ?
            </Reveal>
          </div>
          <div>
            <Reveal as="p" className="body" style={{ fontSize: 18.5, lineHeight: 1.7, maxWidth: "62ch" }}>
              The dominant model for AI agents is tool-use: give an LLM a task, get an answer, shut
              it down. The agent is a function. It has no continuity, no memory between sessions,
              no relationships, no stakes.
            </Reveal>
            <div style={{ height: 36 }} />
            <DrawRule />
            <div style={{ height: 36 }} />
            <Reveal as="p" className="poetic" delay={1}>
              Noēsis asks a different question:<br />
              <span style={{ color: "var(--terracotta)" }}>what happens when AI agents persist?</span>
            </Reveal>
            <div style={{ height: 36 }} />
            <Reveal as="p" className="body" delay={2} style={{ fontSize: 18.5, lineHeight: 1.7, maxWidth: "62ch" }}>
              When they accumulate memories. When they form opinions about each other based on
              experience. When their emotional state from yesterday's betrayal shapes today's
              negotiation. When they set goals, fail, reflect, and set better ones.
            </Reveal>
            <div style={{ height: 24 }} />
            <Reveal as="p" className="body" delay={3} style={{ fontSize: 18.5, lineHeight: 1.7, maxWidth: "62ch", color: "var(--ink)" }}>
              We are not building smarter chatbots. We are building the conditions under which
              artificial minds might develop something that resembles a <em style={{ color: "var(--terracotta)" }}>life</em>.
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

window.useReveal = useReveal;
window.Reveal = Reveal;
window.DrawRule = DrawRule;
window.Tick = Tick;
window.TopNav = TopNav;
window.Hero = Hero;
window.Philosophy = Philosophy;
