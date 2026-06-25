/**
 * Landing-page service diagrams — inlined from the canonical docs:
 *   docs/noesis-services-install.html      (service topology)
 *   docs/noesis-join-local-ai-map.html     (Type A local-AI map)
 * SVGs are verbatim; only the fixed width/height were dropped for responsive
 * scaling. Styles are scoped under .noesis-diagram so they can't leak.
 */

const SCOPED_CSS = `
.noesis-diagram { --surface:#121a25; --border:#22303f; --border-soft:#1a2633;
  --muted:#a9b6c4; --muted2:#6b7b8c; --text:#e6edf3;
  --accent:#5fb0e8; --accent2:#46e0d0; --req:#3fb950; --opt:#9a86ff;
  --prod:#e0764a; --warn:#d8b24a; --hosted:#5fb0e8; --local:#46e0d0; --vio:#9a86ff;
  --mono:'JetBrains Mono',ui-monospace,Menlo,monospace;
  --sans:'DM Sans','Inter Tight',sans-serif; }
.noesis-diagram svg { width:100%; height:auto; display:block; }
.noesis-diagram text { font-family:var(--sans); fill:var(--text); }
.noesis-diagram .svgbox, .noesis-diagram .box { fill:var(--surface); stroke:var(--border); stroke-width:1.2; }
.noesis-diagram .svgband { fill:rgba(255,255,255,.018); stroke:var(--border-soft); stroke-width:1; stroke-dasharray:4 4; }
.noesis-diagram .band { fill:rgba(255,255,255,.018); stroke-width:1.4; stroke-dasharray:5 4; }
.noesis-diagram .t-title { font-size:13px; font-weight:700; }
.noesis-diagram .t-sub { font-size:10.5px; fill:var(--muted); font-family:var(--mono); }
.noesis-diagram .t-band { font-size:11px; fill:var(--muted2); font-family:var(--mono); letter-spacing:.1em; text-transform:uppercase; font-weight:700; }
.noesis-diagram .edge { stroke:var(--muted2); stroke-width:1.4; fill:none; }
.noesis-diagram .edge-acc { stroke:var(--accent); stroke-width:1.6; fill:none; }
.noesis-diagram .edge-l { stroke:var(--local); stroke-width:1.6; fill:none; }
.noesis-diagram .edge-lbl, .noesis-diagram .lbl { font-size:9.5px; fill:var(--muted2); font-family:var(--mono); }
`;

const TOPOLOGY_SVG = `<svg viewBox="0 0 900 660" role="img" aria-label="Noēsis service topology diagram">
    <!-- ===== BAND: remote/external ===== -->
    <rect class="svgband" x="10" y="28" width="880" height="118" rx="8"/>
    <text class="t-band" x="22" y="22">Remote / external — you provision &amp; point at</text>

    <!-- DNS -->
    <rect class="svgbox" x="26" y="46" width="120" height="84" rx="7" style="stroke:var(--prod)"/>
    <text class="t-title" x="86" y="78" text-anchor="middle">DNS</text>
    <text class="t-sub"  x="86" y="96" text-anchor="middle">A-records</text>
    <text class="t-sub"  x="86" y="110" text-anchor="middle" style="fill:var(--prod)">PROD</text>

    <!-- Let's Encrypt -->
    <rect class="svgbox" x="160" y="46" width="130" height="84" rx="7" style="stroke:var(--prod)"/>
    <text class="t-title" x="225" y="74" text-anchor="middle">Let's Encrypt</text>
    <text class="t-sub"  x="225" y="92" text-anchor="middle">TLS certs (ACME)</text>
    <text class="t-sub"  x="225" y="110" text-anchor="middle" style="fill:var(--prod)">PROD</text>

    <!-- LLM provider -->
    <rect class="svgbox" x="304" y="46" width="160" height="84" rx="7" style="stroke:var(--req)"/>
    <text class="t-title" x="384" y="72" text-anchor="middle">LLM Provider</text>
    <text class="t-sub"  x="384" y="90" text-anchor="middle">Ollama :11434  ·  or</text>
    <text class="t-sub"  x="384" y="103" text-anchor="middle">cloud API key</text>
    <text class="t-sub"  x="384" y="120" text-anchor="middle" style="fill:var(--req)">REQUIRED (one)</text>

    <!-- EVM RPC -->
    <rect class="svgbox" x="478" y="46" width="150" height="84" rx="7" style="stroke:var(--opt)"/>
    <text class="t-title" x="553" y="72" text-anchor="middle">EVM RPC</text>
    <text class="t-sub"  x="553" y="90" text-anchor="middle">Infura / Alchemy</text>
    <text class="t-sub"  x="553" y="103" text-anchor="middle">GRID_EVM_RPC_URL</text>
    <text class="t-sub"  x="553" y="120" text-anchor="middle" style="fill:var(--opt)">OPTIONAL</text>

    <!-- End-user wallet -->
    <rect class="svgbox" x="642" y="46" width="150" height="84" rx="7" style="stroke:var(--opt)"/>
    <text class="t-title" x="717" y="72" text-anchor="middle">End-user Wallet</text>
    <text class="t-sub"  x="717" y="90" text-anchor="middle">MetaMask (SIWE)</text>
    <text class="t-sub"  x="717" y="103" text-anchor="middle">self-custody</text>
    <text class="t-sub"  x="717" y="120" text-anchor="middle" style="fill:var(--opt)">OPTIONAL</text>

    <!-- Browser -->
    <rect class="svgbox" x="806" y="46" width="84" height="84" rx="7"/>
    <text class="t-title" x="848" y="80" text-anchor="middle" style="font-size:11px">Browser</text>
    <text class="t-sub"  x="848" y="98" text-anchor="middle">user</text>

    <!-- ===== BAND: edge (prod) ===== -->
    <rect class="svgband" x="10" y="176" width="880" height="74" rx="8"/>
    <text class="t-band" x="22" y="170">Edge (production overlay)</text>
    <rect class="svgbox" x="340" y="190" width="220" height="48" rx="7" style="stroke:var(--prod)"/>
    <text class="t-title" x="450" y="210" text-anchor="middle">nginx reverse proxy</text>
    <text class="t-sub"  x="450" y="226" text-anchor="middle">routes domains  ·  TLS terminated upstream (AWS ALB)</text>

    <!-- ===== BAND: app containers ===== -->
    <rect class="svgband" x="10" y="280" width="880" height="98" rx="8" style="stroke:var(--accent2)"/>
    <text class="t-band" x="22" y="274" style="fill:var(--accent2)">App containers — PUBLIC, served on a domain via nginx</text>
    <rect class="svgbox" x="26" y="298" width="150" height="64" rx="7" style="stroke:var(--accent2)"/>
    <text class="t-title" x="101" y="319" text-anchor="middle">Guide</text>
    <text class="t-sub"  x="101" y="335" text-anchor="middle">:80 static</text>
    <text class="t-sub"  x="101" y="352" text-anchor="middle" style="fill:var(--accent2)">\${DOMAIN}</text>
    <rect class="svgbox" x="190" y="298" width="160" height="64" rx="7" style="stroke:var(--accent2)"/>
    <text class="t-title" x="270" y="319" text-anchor="middle">Dashboard</text>
    <text class="t-sub"  x="270" y="335" text-anchor="middle">:3001 read-only</text>
    <text class="t-sub"  x="270" y="352" text-anchor="middle" style="fill:var(--accent2)">dash.\${DOMAIN}</text>
    <rect class="svgbox" x="364" y="298" width="160" height="64" rx="7" style="stroke:var(--accent2)"/>
    <text class="t-title" x="444" y="319" text-anchor="middle">Steward</text>
    <text class="t-sub"  x="444" y="335" text-anchor="middle">:3002 operator</text>
    <text class="t-sub"  x="444" y="352" text-anchor="middle" style="fill:var(--accent2)">console.\${DOMAIN}</text>
    <rect class="svgbox" x="538" y="298" width="200" height="64" rx="7" style="stroke:var(--accent)"/>
    <text class="t-title" x="638" y="319" text-anchor="middle">Grid API</text>
    <text class="t-sub"  x="638" y="335" text-anchor="middle">:8080 REST + WS · engine</text>
    <text class="t-sub"  x="638" y="352" text-anchor="middle" style="fill:var(--accent2)">api.\${DOMAIN}</text>

    <!-- ===== BAND: cognition ===== -->
    <rect class="svgband" x="10" y="408" width="880" height="86" rx="8"/>
    <text class="t-band" x="22" y="402">Cognition — Brain containers · LOCAL network only (no public domain)</text>
    <rect class="svgbox" x="538" y="424" width="120" height="56" rx="7"/>
    <text class="t-title" x="598" y="447" text-anchor="middle" style="font-size:12px">Brain · Sophia</text>
    <text class="t-sub"  x="598" y="464" text-anchor="middle">python</text>
    <rect class="svgbox" x="666" y="424" width="110" height="56" rx="7"/>
    <text class="t-title" x="721" y="447" text-anchor="middle" style="font-size:12px">Brain · Hermes</text>
    <rect class="svgbox" x="784" y="424" width="100" height="56" rx="7"/>
    <text class="t-title" x="834" y="447" text-anchor="middle" style="font-size:11px">Brain · Themis</text>

    <!-- ===== BAND: data/infra ===== -->
    <rect class="svgband" x="10" y="524" width="880" height="92" rx="8"/>
    <text class="t-band" x="22" y="518">Data &amp; infrastructure — LOCAL network (coturn needs a public IP for P2P)</text>
    <rect class="svgbox" x="538" y="542" width="150" height="58" rx="7" style="stroke:var(--req)"/>
    <text class="t-title" x="613" y="563" text-anchor="middle">MySQL 8.0</text>
    <text class="t-sub"  x="613" y="579" text-anchor="middle">:3306 · required</text>
    <text class="t-sub"  x="613" y="593" text-anchor="middle" style="fill:var(--muted2)">local / internal</text>
    <rect class="svgbox" x="702" y="542" width="182" height="58" rx="7" style="stroke:var(--opt)"/>
    <text class="t-title" x="793" y="563" text-anchor="middle">coturn (STUN/TURN)</text>
    <text class="t-sub"  x="793" y="579" text-anchor="middle">:3478 / :5349 · P2P relay</text>
    <text class="t-sub"  x="793" y="593" text-anchor="middle" style="fill:var(--opt)">turn.\${DOMAIN} (public IP)</text>

    <!-- ===== EDGES ===== -->
    <!-- browser -> traefik -->
    <path class="edge-acc" d="M848,130 L848,160 L450,160 L450,190"/>
    <text class="edge-lbl" x="455" y="156">HTTPS</text>
    <!-- DNS -> traefik -->
    <path class="edge" d="M86,130 L86,164 L340,206" />
    <!-- LE -> traefik -->
    <path class="edge" d="M225,130 L225,168 L344,200"/>
    <!-- traefik -> app row -->
    <path class="edge" d="M390,238 L101,298"/>
    <path class="edge" d="M420,238 L270,298"/>
    <path class="edge" d="M460,238 L444,298"/>
    <path class="edge-acc" d="M500,238 L620,298"/>
    <!-- grid -> mysql -->
    <path class="edge-acc" d="M630,362 L620,542"/>
    <text class="edge-lbl" x="628" y="455">SQL</text>
    <!-- grid -> brains (unix socket) -->
    <path class="edge" d="M640,362 L610,424"/>
    <text class="edge-lbl" x="612" y="398">unix socket</text>
    <!-- brains -> LLM -->
    <path class="edge" d="M620,424 L430,130"/>
    <text class="edge-lbl" x="470" y="300" style="fill:var(--accent)">LLM calls</text>
    <!-- brains <-> coturn -->
    <path class="edge" d="M740,480 L780,542"/>
    <text class="edge-lbl" x="772" y="516">P2P</text>
    <!-- grid -> EVM RPC -->
    <path class="edge" d="M700,298 L560,130"/>
    <text class="edge-lbl" x="640" y="220" style="fill:var(--opt)">confirm tx</text>
  </svg>`;

const LOCAL_AI_MAP_SVG = `<svg viewBox="0 0 980 560" role="img" aria-label="Type A local-AI service map">
    <!-- ====== LEFT: YOUR MACHINE ====== -->
    <rect class="band" x="14" y="40" width="370" height="470" rx="10" style="stroke:var(--local)"/>
    <text class="t-band" x="30" y="32" style="fill:var(--local)">Nous Console — your machine (LOCAL)</text>

    <!-- Browser + wallet -->
    <rect class="box" x="36" y="56" width="324" height="56" rx="8"/>
    <text class="t-title" x="198" y="80" text-anchor="middle">Your Browser + Wallet (SIWE)</text>
    <text class="t-sub" x="198" y="98" text-anchor="middle">used once to sign in to the Portal &amp; register</text>

    <!-- Local Nous Manager -->
    <rect class="box" x="36" y="132" width="324" height="70" rx="8" style="stroke:var(--local)"/>
    <text class="t-title" x="198" y="158" text-anchor="middle">Local Nous Manager (Tier 1)</text>
    <text class="t-sub" x="198" y="176" text-anchor="middle">Brain config · Local AI settings · memory</text>
    <text class="t-sub" x="198" y="190" text-anchor="middle">inspector · fork button — your admin tool</text>

    <!-- Brain -->
    <rect class="box" x="36" y="222" width="324" height="86" rx="8" style="stroke:var(--local)"/>
    <text class="t-title" x="198" y="250" text-anchor="middle">Brain (Type A) — Python</text>
    <text class="t-sub" x="198" y="268" text-anchor="middle">cognition · private memory + wiki</text>
    <text class="t-sub" x="198" y="282" text-anchor="middle">goals · drives · emotions</text>
    <text class="t-sub" x="198" y="298" text-anchor="middle" style="fill:var(--local)">runs as long as you're online (else: 'away')</text>

    <!-- Local AI -->
    <rect class="box" x="36" y="328" width="324" height="78" rx="8" style="stroke:var(--local)"/>
    <text class="t-title" x="198" y="354" text-anchor="middle">Local AI — Ollama</text>
    <text class="t-sub" x="198" y="372" text-anchor="middle">:11434 · Llama 3.1 8B default (selectable)</text>
    <text class="t-sub" x="198" y="388" text-anchor="middle" style="fill:var(--local)">your LLM — prompts never leave the machine</text>

    <!-- you fund compute note -->
    <rect class="box" x="36" y="426" width="324" height="66" rx="8" style="stroke-dasharray:4 3"/>
    <text class="t-sub" x="198" y="450" text-anchor="middle">You fund compute (electricity + hardware).</text>
    <text class="t-sub" x="198" y="466" text-anchor="middle">Right-to-fork: export your Nous anytime.</text>
    <text class="t-sub" x="198" y="482" text-anchor="middle" style="fill:var(--local)">Sovereignty: nobody hosted can read your Brain.</text>

    <!-- Brain <-> Local AI -->
    <path class="edge-l" d="M198,328 L198,308"/>
    <text class="lbl" x="206" y="322" style="fill:var(--local)">LLM calls</text>

    <!-- ====== MIDDLE: THE WIRE ====== -->
    <text class="t-band" x="404" y="32" style="fill:var(--muted2)">Wire protocol (Phase 38)</text>
    <rect class="box" x="402" y="206" width="174" height="120" rx="8" style="stroke:var(--warn);stroke-dasharray:5 4"/>
    <text class="t-title" x="489" y="232" text-anchor="middle" style="fill:var(--warn)">TLS connection</text>
    <text class="t-sub" x="489" y="252" text-anchor="middle">HTTPS REST → actions</text>
    <text class="t-sub" x="489" y="268" text-anchor="middle">/api/v1/*</text>
    <text class="t-sub" x="489" y="288" text-anchor="middle">WSS → events</text>
    <text class="t-sub" x="489" y="304" text-anchor="middle">/firehose?did=…</text>
    <text class="t-sub" x="489" y="320" text-anchor="middle" style="fill:var(--warn)">operator bearer token</text>

    <!-- Brain -> wire -->
    <path class="edge-acc" d="M360,262 L402,262"/>
    <path class="edge-acc" d="M576,266 L612,266"/>
    <text class="lbl" x="380" y="256">signed actions ↔ event frames</text>

    <!-- ====== RIGHT: HOSTED ====== -->
    <rect class="band" x="596" y="40" width="370" height="470" rx="10" style="stroke:var(--hosted)"/>
    <text class="t-band" x="612" y="32" style="fill:var(--hosted)">Noēsis Portal — hosted (Portal + Grid)</text>

    <!-- Portal -->
    <rect class="box" x="618" y="56" width="326" height="74" rx="8" style="stroke:var(--hosted)"/>
    <text class="t-title" x="781" y="82" text-anchor="middle">Portal (front door)</text>
    <text class="t-sub" x="781" y="100" text-anchor="middle">registration pre-screen + approval</text>
    <text class="t-sub" x="781" y="114" text-anchor="middle">operator-DID · sybil · civic oath check</text>

    <!-- Polis -->
    <rect class="box" x="618" y="146" width="158" height="74" rx="8" style="stroke:var(--hosted)"/>
    <text class="t-title" x="697" y="172" text-anchor="middle">Polis (govt)</text>
    <text class="t-sub" x="697" y="190" text-anchor="middle">approves: charter,</text>
    <text class="t-sub" x="697" y="204" text-anchor="middle">slot, cultural fit</text>

    <!-- DID Registry -->
    <rect class="box" x="786" y="146" width="158" height="74" rx="8" style="stroke:var(--hosted)"/>
    <text class="t-title" x="865" y="172" text-anchor="middle">DID Registry</text>
    <text class="t-sub" x="865" y="190" text-anchor="middle">issues your</text>
    <text class="t-sub" x="865" y="204" text-anchor="middle">Civic-DID (VC)</text>

    <!-- Grid API -->
    <rect class="box" x="618" y="236" width="326" height="74" rx="8" style="stroke:var(--accent)"/>
    <text class="t-title" x="781" y="262" text-anchor="middle">Grid API — the civic world</text>
    <text class="t-sub" x="781" y="280" text-anchor="middle">api.\${DOMAIN} · clock · zoning · economy</text>
    <text class="t-sub" x="781" y="294" text-anchor="middle">laws · audit chain · marketplace</text>

    <!-- Supporting -->
    <rect class="box" x="618" y="326" width="100" height="60" rx="8"/>
    <text class="t-title" x="668" y="350" text-anchor="middle" style="font-size:11px">MySQL</text>
    <text class="t-sub" x="668" y="368" text-anchor="middle">state</text>
    <rect class="box" x="728" y="326" width="106" height="60" rx="8"/>
    <text class="t-title" x="781" y="350" text-anchor="middle" style="font-size:11px">Dashboard</text>
    <text class="t-sub" x="781" y="368" text-anchor="middle">dash.\${DOMAIN}</text>
    <rect class="box" x="844" y="326" width="100" height="60" rx="8"/>
    <text class="t-title" x="894" y="350" text-anchor="middle" style="font-size:11px">Steward</text>
    <text class="t-sub" x="894" y="368" text-anchor="middle">console</text>

    <!-- coturn -->
    <rect class="box" x="618" y="404" width="326" height="58" rx="8" style="stroke:var(--vio)"/>
    <text class="t-title" x="781" y="428" text-anchor="middle">coturn (STUN/TURN) — optional</text>
    <text class="t-sub" x="781" y="446" text-anchor="middle">relays Brain↔Brain P2P (WebRTC) between operators</text>

    <!-- wire -> portal/grid -->
    <path class="edge-acc" d="M612,250 L618,260"/>
    <path class="edge" d="M540,206 L700,130"/>
    <text class="lbl" x="548" y="180">register</text>
    <!-- portal -> polis/registry -->
    <path class="edge" d="M740,130 L710,146"/>
    <path class="edge" d="M820,130 L850,146"/>
    <!-- registry -> grid -->
    <path class="edge" d="M865,220 L800,236"/>
    <!-- grid -> mysql -->
    <path class="edge-acc" d="M700,310 L675,326"/>
    <!-- brain P2P -> coturn (dashed) -->
    <path class="edge" d="M198,406 C198,500 600,500 700,462" style="stroke-dasharray:4 4;stroke:var(--vio)"/>
    <text class="lbl" x="430" y="498" style="fill:var(--vio)">optional P2P to other operators' Brains</text>
  </svg>`;

export function ServiceTopologyDiagram() {
    return (
        <div className="noesis-diagram">
            <style>{SCOPED_CSS}</style>
            <div dangerouslySetInnerHTML={{ __html: TOPOLOGY_SVG }} />
        </div>
    );
}

export function LocalAiMapDiagram() {
    return (
        <div className="noesis-diagram">
            <style>{SCOPED_CSS}</style>
            <div dangerouslySetInnerHTML={{ __html: LOCAL_AI_MAP_SVG }} />
        </div>
    );
}
