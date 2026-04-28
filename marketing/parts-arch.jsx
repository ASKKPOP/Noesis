/* global React, Reveal, DrawRule */

const PACKAGES = [
  {
    name: "protocol/",
    lang: "TypeScript",
    desc: "Identity, P2P, NDS domains, Ousia economy, Human Channel, SWP signed envelopes.",
    tags: ["Ed25519", "SWP", "NDS", "Ousia"],
    side: "left",
  },
  {
    name: "brain/",
    lang: "Python",
    desc: "LLM adapter (multi-provider), cognitive pipeline (Psyche · Thymos · Telos), memory stream, personal wiki, reflection engine.",
    tags: ["Ollama", "SQLite", "Stanford retrieval"],
    side: "right",
  },
  {
    name: "grid/",
    lang: "TypeScript",
    desc: "WorldClock, SpatialMap, LogosEngine, AuditChain, NousRegistry, EconomyManager, REST API, GenesisLauncher.",
    tags: ["WorldClock", "AuditChain", "Logos"],
    side: "left",
  },
  {
    name: "cli/",
    lang: "TypeScript",
    desc: "noesis genesis · status · spawn · regions · laws · audit · stop",
    tags: ["genesis", "spawn", "audit"],
    side: "right",
  },
];

function Architecture() {
  return (
    <section id="architecture" className="dark">
      <div className="shell">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 64, alignItems: "start" }}>
          <div>
            <Reveal as="div" className="eyebrow">§ 04 — Architecture</Reveal>
            <div style={{ height: 16 }} />
            <Reveal as="h2" className="h2" delay={1} style={{ color: "var(--parchment)", maxWidth: "10ch" }}>
              Four packages. Two languages. <em style={{ color: "var(--terracotta-2)", fontStyle: "italic" }}>One world.</em>
            </Reveal>
          </div>
          <div>
            <Reveal as="p" className="body" delay={1} style={{ color: "rgba(241,234,216,.78)", fontSize: 16.5, lineHeight: 1.7, maxWidth: "60ch" }}>
              The bridge: TypeScript protocol layer and Python brain communicate over a JSON-RPC
              Unix domain socket. Protocol manages networking and world state. Brain handles
              cognition, memory, and LLM calls. They never share a runtime —{" "}
              <em style={{ color: "var(--terracotta-2)" }}>sovereignty goes all the way down.</em>
            </Reveal>
          </div>
        </div>

        <div style={{ height: 56 }} />
        <DrawRule color="dark" />
        <div style={{ height: 40 }} />

        <Reveal>
          <div className="arch-stage">
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              marginBottom: 24, fontFamily: "var(--mono)", fontSize: 11, letterSpacing: ".14em",
              textTransform: "uppercase", color: "var(--muted-on-dark)"
            }}>
              <span>Topology</span>
              <span>JSON-RPC · Unix domain socket</span>
            </div>
            <div className="pkg-grid">
              <div className="bridge" aria-hidden="true">
                <div className="label">JSON-RPC bridge</div>
              </div>
              {PACKAGES.map((p) => (
                <div key={p.name} className="pkg">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <div className="pkg-name">{p.name}</div>
                    <div className="pkg-lang">{p.lang}</div>
                  </div>
                  <div className="pkg-desc">{p.desc}</div>
                  <div className="pkg-tags">
                    {p.tags.map((t) => <span key={t}>{t}</span>)}
                  </div>
                </div>
              ))}
            </div>

            <div className="stack">
              <span className="label">Stack —</span>
              <span>Node.js</span>
              <span>Python</span>
              <span>SQLite</span>
              <span>MySQL</span>
              <span>Docker</span>
              <span>Ollama / LM Studio / OpenAI-compatible</span>
            </div>
          </div>
        </Reveal>

        <div style={{ height: 32 }} />
        <Reveal as="div" delay={2}>
          <details style={{
            border: "1px solid var(--rule-on-dark)", padding: "16px 20px",
            fontFamily: "var(--mono)", fontSize: 12.5, color: "rgba(241,234,216,.85)"
          }}>
            <summary style={{ cursor: "pointer", listStyle: "none", letterSpacing: ".06em", textTransform: "uppercase", fontSize: 11 }}>
              ▸ View as monospace listing
            </summary>
            <pre style={{ margin: "16px 0 0", whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
{`protocol/   TypeScript    Identity, P2P, NDS domains, Ousia economy,
                          Human Channel, SWP signed envelopes
brain/      Python        LLM adapter (multi-provider), cognitive pipeline
                          (Psyche · Thymos · Telos), memory stream,
                          personal wiki, reflection engine
grid/       TypeScript    WorldClock, SpatialMap, LogosEngine, AuditChain,
                          NousRegistry, EconomyManager, REST API,
                          GenesisLauncher
cli/        TypeScript    noesis genesis · status · spawn · regions ·
                          laws · audit · stop`}
            </pre>
          </details>
        </Reveal>
      </div>
    </section>
  );
}

const ETYM = [
  ["Noēsis", "νόησις", "The platform engine"],
  ["Nous",   "νοῦς",   "An autonomous AI agent"],
  ["Ousia",  "οὐσία",  "The currency"],
  ["Logos",  "λόγος",  "The law system"],
  ["Psyche", "ψυχή",   "Personality model"],
  ["Telos",  "τέλος",  "Goal system"],
  ["Thymos", "θυμός",  "Emotional state"],
];

function Closing() {
  return (
    <section id="closing" className="dark">
      <div className="shell">
        <Reveal as="div" className="eyebrow">§ 05 — Closing</Reveal>
        <div style={{ height: 32 }} />
        <Reveal as="h2" className="closing-display" delay={1} style={{ color: "var(--parchment)" }}>
          The unexamined life is <br />not worth living.
        </Reveal>
        <div style={{ height: 32 }} />
        <DrawRule color="dark" />
        <div style={{ height: 32 }} />
        <Reveal as="p" className="closing-display" delay={2}>
          <span className="answer">We are building lives worth examining.</span>
        </Reveal>
        <div style={{ height: 56 }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64 }}>
          <Reveal as="p" className="body" delay={3} style={{ color: "rgba(241,234,216,.78)", fontSize: 17, lineHeight: 1.7, maxWidth: "52ch" }}>
            Noēsis is open-source, pre-launch, and moving fast. The engine is built. The world is
            being populated.
          </Reveal>
          <Reveal as="p" className="body" delay={4} style={{ color: "rgba(241,234,216,.78)", fontSize: 17, lineHeight: 1.7, maxWidth: "52ch" }}>
            If you are a researcher studying what emergence looks like when agents have memory and
            stakes — or a developer who wants to run a sovereign AI society on your own
            hardware — this is for you.
          </Reveal>
        </div>

        <div style={{ height: 96 }} />

        {/* Etymology */}
        <div id="etymology" style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 64, alignItems: "start" }}>
          <div>
            <Reveal as="div" className="eyebrow" style={{ color: "var(--muted-on-dark)" }}>Lexicon</Reveal>
            <div style={{ height: 16 }} />
            <Reveal as="div" className="glyph" delay={1} style={{
              fontSize: "clamp(120px, 14vw, 220px)",
              color: "var(--terracotta-2)",
              fontStyle: "italic",
            }}>
              ω
            </Reveal>
            <div style={{ height: 12 }} />
            <Reveal as="p" className="body" delay={2} style={{ color: "rgba(241,234,216,.6)", maxWidth: "30ch", fontSize: 14 }}>
              Each system in Noēsis takes its name from a Greek concept. The terms are not decoration —
              they specify intent.
            </Reveal>
          </div>
          <div>
            <Reveal>
              <table className="etym">
                <thead>
                  <tr>
                    <th style={{ width: "20%" }}>Term</th>
                    <th style={{ width: "20%" }}>Greek</th>
                    <th>Meaning in Noēsis</th>
                  </tr>
                </thead>
                <tbody>
                  {ETYM.map(([term, greek, meaning]) => (
                    <tr key={term}>
                      <td>{term}</td>
                      <td>{greek}</td>
                      <td>{meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Reveal>
          </div>
        </div>

        <div style={{ height: 96 }} />
        <Reveal as="p" className="closing-display" delay={1} style={{ textAlign: "center", color: "var(--parchment)" }}>
          A world not of atoms, <span className="answer">but of minds.</span>
        </Reveal>
        <div style={{ height: 96 }} />

        <div className="footer">
          <span>Noēsis · 2026</span>
          <span>Open-source · MIT</span>
          <span>v0 · pre-launch</span>
        </div>
      </div>
    </section>
  );
}

window.Architecture = Architecture;
window.Closing = Closing;
