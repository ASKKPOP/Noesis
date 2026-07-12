import { useCallback, useEffect, useState } from 'react';
import type { ApiResult, Settings } from './lnm';

type Tab = 'overview' | 'memory' | 'wiki' | 'localai' | 'process' | 'config' | 'settings';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'memory', label: 'Memory' },
  { id: 'wiki', label: 'Personal Wiki' },
  { id: 'localai', label: 'Local AI' },
  { id: 'process', label: 'Process' },
  { id: 'config', label: 'Brain Config' },
  { id: 'settings', label: 'Settings' },
];

function useApi(key: Parameters<NonNullable<Window['lnm']>['apiGet']>[0], everyMs: number, active: boolean) {
  const [res, setRes] = useState<ApiResult | null>(null);
  useEffect(() => {
    if (!active || !window.lnm) return;
    let stop = false;
    const load = async () => {
      const r = await window.lnm!.apiGet(key);
      if (!stop) setRes(r);
    };
    load();
    const t = setInterval(load, everyMs);
    return () => { stop = true; clearInterval(t); };
  }, [key, everyMs, active]);
  return res;
}

function Err({ res, what }: { res: ApiResult | null; what: string }) {
  if (!res || res.ok) return null;
  return (
    <div className="err">
      Cannot reach the Brain for {what} ({res.status || 'no connection'}): {res.error || 'unknown error'}.
      Start the Brain in the Process tab and check the secret/port in Settings.
    </div>
  );
}

// ── Overview ────────────────────────────────────────────────────────────────
function Overview({ active }: { active: boolean }) {
  const res = useApi('state', 2000, active);
  const s = res?.ok ? res.data : null;
  return (
    <div className="panel">
      <Err res={res} what="cognitive state" />
      {!s && <div className="empty">No state yet — is the Brain running?</div>}
      {s && (
        <div className="grid2">
          <div className="card">
            <h3>{s.name || 'Nous'} <span className="note">· {s.archetype}</span></h3>
            <div className="kv"><span className="k">DID</span><span>{s.did}</span></div>
            <div className="kv"><span className="k">Grid</span><span>{s.grid_name}</span></div>
            <div className="kv"><span className="k">Location</span><span>{s.location}</span></div>
            <div className="kv"><span className="k">Mood</span><span>{s.mood}</span></div>
            <div className="kv"><span className="k">Emotions</span><span>{s.emotions}</span></div>
          </div>
          <div className="card">
            <h3>Goals (telos)</h3>
            {(s.active_goals || []).length === 0 && <div className="note">No active goals.</div>}
            {(s.active_goals || []).map((g: string, i: number) => (
              <div className="kv" key={i}><span>{g}</span></div>
            ))}
          </div>
          <div className="card">
            <h3>Perception (aisthesis) <span className="tag sage">input edge</span></h3>
            <div className="kv"><span className="k">World size</span><span>{s.aisthesis?.world_size ?? 0}</span></div>
            <div className="kv"><span className="k">Latest percepts</span><span>{s.aisthesis?.percept_count ?? 0}</span></div>
            <div className="tagrow">
              {(s.aisthesis?.percepts || []).slice(0, 6).map((p: any, i: number) => (
                <span className="tag sage" key={i}>{p.label} {p.kind}</span>
              ))}
            </div>
          </div>
          <div className="card">
            <h3>Action (praxis) <span className="tag">output edge</span></h3>
            <div className="kv"><span className="k">Total deeds</span><span>{s.praxis?.total_deeds ?? 0}</span></div>
            <div className="kv"><span className="k">Repertoire</span><span>{s.praxis?.repertoire_size ?? 0} verbs</span></div>
            <div className="tagrow">
              {Object.entries(s.praxis?.verb_counts || {}).slice(0, 8).map(([v, n]) => (
                <span className="tag" key={v}>{v} ×{String(n)}</span>
              ))}
            </div>
          </div>
          <div className="card">
            <h3>Research (synopsis) <span className="tag blue">background</span></h3>
            <div className="kv"><span className="k">Digests</span><span>{s.synopsis?.count ?? 0}</span></div>
            {s.synopsis?.latest && (
              <>
                <div className="kv"><span className="k">Latest topic</span><span>{s.synopsis.latest.topic}</span></div>
                {(s.synopsis.latest.key_points || []).slice(0, 3).map((p: string, i: number) => (
                  <div className="kv" key={i}><span className="note">{p}</span></div>
                ))}
              </>
            )}
          </div>
          <div className="card">
            <h3>Memory highlights</h3>
            {(s.memory_highlights || []).map((m: any, i: number) => (
              <div className="memrow" key={i}>{m.content}
                <div className="meta">importance {m.importance}</div>
              </div>
            ))}
            {(s.memory_highlights || []).length === 0 && <div className="note">Nothing yet.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Memory browser ──────────────────────────────────────────────────────────
function MemoryBrowser({ active }: { active: boolean }) {
  const res = useApi('memory', 4000, active);
  const rows = res?.ok ? res.data.memories : [];
  return (
    <div className="panel">
      <Err res={res} what="memories" />
      <div className="card">
        <h3>Recent episodic memory <span className="note">· {rows.length} shown</span></h3>
        {rows.length === 0 && <div className="empty">No memories yet.</div>}
        {rows.map((m: any, i: number) => (
          <div className="memrow" key={i}>
            {m.content}
            <div className="meta">
              {m.memory_type} · tick {m.tick} · importance {m.importance}
              {m.source_did ? ` · ${m.source_did}` : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Personal wiki (episteme) ────────────────────────────────────────────────
function WikiBrowser({ active }: { active: boolean }) {
  const res = useApi('wiki', 6000, active);
  const pages = res?.ok ? res.data.pages : [];
  return (
    <div className="panel">
      <Err res={res} what="wiki pages" />
      {pages.length === 0 && <div className="empty">The personal wiki is empty.</div>}
      {pages.map((p: any, i: number) => (
        <div className="card" key={i}>
          <h3>{p.title} <span className="tag">{p.category}</span>
            <span className="note"> · confidence {Math.round((p.confidence ?? 0) * 100)}%</span></h3>
          <div>{p.content}</div>
          {p.source && <div className="note">source: {p.source}</div>}
        </div>
      ))}
    </div>
  );
}

// ── Local AI ────────────────────────────────────────────────────────────────
function LocalAI({ active }: { active: boolean }) {
  const status = useApi('aiStatus', 4000, active);
  const models = useApi('aiModels', 10000, active);
  return (
    <div className="panel">
      <Err res={status} what="Local AI status" />
      <div className="grid2">
        <div className="card">
          <h3>Status</h3>
          {status?.ok
            ? Object.entries(status.data || {}).map(([k, v]) => (
                <div className="kv" key={k}><span className="k">{k}</span><span>{JSON.stringify(v)}</span></div>
              ))
            : <div className="note">Unavailable.</div>}
        </div>
        <div className="card">
          <h3>Models</h3>
          {models?.ok
            ? <pre className="note" style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(models.data, null, 2)}</pre>
            : <div className="note">Unavailable.</div>}
        </div>
      </div>
    </div>
  );
}

// ── Process control ─────────────────────────────────────────────────────────
function ProcessPanel({ active, onStatus }: { active: boolean; onStatus: (r: boolean) => void }) {
  const [running, setRunning] = useState(false);
  const [pid, setPid] = useState<number | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!active || !window.lnm) return;
    let stop = false;
    const poll = async () => {
      const st = await window.lnm!.brainStatus();
      const lg = await window.lnm!.brainLogs();
      if (stop) return;
      setRunning(st.running); setPid(st.pid); setLogs(lg); onStatus(st.running);
    };
    poll();
    const t = setInterval(poll, 1500);
    return () => { stop = true; clearInterval(t); };
  }, [active, onStatus]);

  const start = async () => {
    setErr('');
    const r = await window.lnm!.brainStart();
    if (!r.ok) setErr(r.error || 'failed to start');
  };
  const stopBrain = async () => {
    setErr('');
    const r = await window.lnm!.brainStop();
    if (!r.ok) setErr(r.error || 'failed to stop');
  };

  return (
    <div className="panel">
      {err && <div className="err">{err}</div>}
      <div className="card">
        <h3>Brain process</h3>
        <div className="kv"><span className="k">Status</span>
          <span>{running ? `running (pid ${pid})` : 'stopped'}</span></div>
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button className="act" onClick={start} disabled={running}>Start Brain</button>
          <button className="act ghost" onClick={stopBrain} disabled={!running}>Stop</button>
        </div>
      </div>
      <div className="card">
        <h3>Logs</h3>
        <div className="logs">{logs.length ? logs.join('\n') : '— no output yet —'}</div>
      </div>
    </div>
  );
}

// ── Brain config editor ─────────────────────────────────────────────────────
function ConfigEditor({ active }: { active: boolean }) {
  const [text, setText] = useState('');
  const [path, setPath] = useState('');
  const [msg, setMsg] = useState('');
  const load = useCallback(async () => {
    const r = await window.lnm!.configRead();
    if (r.ok) { setText(r.text || ''); setPath(r.path || ''); setMsg(''); }
    else setMsg(r.error || 'cannot read config');
  }, []);
  useEffect(() => { if (active && window.lnm) load(); }, [active, load]);
  const save = async () => {
    const r = await window.lnm!.configWrite(text);
    setMsg(r.ok ? `Saved (backup at ${path}.bak). Restart the Brain to apply.` : (r.error || 'save failed'));
  };
  return (
    <div className="panel">
      {msg && <div className={msg.startsWith('Saved') ? 'note' : 'err'} style={{ marginBottom: 10 }}>{msg}</div>}
      <div className="card">
        <h3>Nous YAML <span className="note">· {path || 'set configPath in Settings'}</span></h3>
        <textarea className="code" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button className="act" onClick={save} disabled={!path}>Save</button>
          <button className="act ghost" onClick={load}>Reload</button>
        </div>
      </div>
    </div>
  );
}

// ── Settings ────────────────────────────────────────────────────────────────
function SettingsPanel({ active }: { active: boolean }) {
  const [s, setS] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (active && window.lnm) window.lnm.settingsGet().then(setS); }, [active]);
  if (!s) return <div className="panel"><div className="empty">Loading…</div></div>;
  const upd = (k: keyof Settings, v: string | number) => { setS({ ...s, [k]: v } as Settings); setSaved(false); };
  const save = async () => { await window.lnm!.settingsSave(s); setSaved(true); };
  return (
    <div className="panel">
      <div className="card" style={{ maxWidth: 620 }}>
        <h3>Connection & launch</h3>
        <label>Brain directory (repo's brain/)</label>
        <input value={s.brainDir} onChange={(e) => upd('brainDir', e.target.value)} placeholder="/path/to/Noesis/brain" />
        <label>Python (absolute, or relative to brain dir)</label>
        <input value={s.pythonPath} onChange={(e) => upd('pythonPath', e.target.value)} />
        <label>Nous YAML config path</label>
        <input value={s.configPath} onChange={(e) => upd('configPath', e.target.value)} placeholder="/path/to/Noesis/brain/data/nous/sophia.yaml" />
        <label>Brain HTTP port</label>
        <input type="number" value={s.httpPort} onChange={(e) => upd('httpPort', Number(e.target.value))} />
        <label>Brain HTTP secret (BRAIN_HTTP_SECRET)</label>
        <input type="password" value={s.httpSecret} onChange={(e) => upd('httpSecret', e.target.value)} />
        <div style={{ display: 'flex', gap: 10, marginTop: 14, alignItems: 'center' }}>
          <button className="act" onClick={save}>Save settings</button>
          {saved && <span className="note">Saved.</span>}
        </div>
      </div>
    </div>
  );
}

// ── App shell ───────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState<Tab>('overview');
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!window.lnm) return;
    const t = setInterval(async () => setRunning((await window.lnm!.brainStatus()).running), 3000);
    return () => clearInterval(t);
  }, []);

  if (!window.lnm) {
    return (
      <div className="panel">
        <div className="err">
          This UI must run inside the Electron shell (<code>npm start</code> in
          <code> apps/local-nous-manager</code>) — the preload bridge is missing.
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="titlebar">
        <h1>Local Nous Manager</h1>
        <span className="tier">Tier 1 · operator</span>
        <span className="status"><i className={`dot ${running ? 'on' : 'off'}`} />
          {running ? 'Brain running' : 'Brain stopped'}</span>
      </div>
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'overview' && <Overview active />}
      {tab === 'memory' && <MemoryBrowser active />}
      {tab === 'wiki' && <WikiBrowser active />}
      {tab === 'localai' && <LocalAI active />}
      {tab === 'process' && <ProcessPanel active onStatus={setRunning} />}
      {tab === 'config' && <ConfigEditor active />}
      {tab === 'settings' && <SettingsPanel active />}
    </>
  );
}
