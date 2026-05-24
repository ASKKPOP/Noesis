'use client';

import { use } from 'react';

const cardStyle: React.CSSProperties = {
    background: 'var(--vellum)',
    border: '1px solid var(--rule)',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 20,
};

const cardHeaderStyle: React.CSSProperties = {
    padding: '14px 20px',
    borderBottom: '1px solid var(--rule)',
    fontFamily: 'var(--serif)',
    fontSize: 17,
    fontWeight: 400,
    color: 'var(--ink)',
};

const fieldRowStyle: React.CSSProperties = {
    padding: '14px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    borderBottom: '1px solid var(--rule)',
};

const fieldRowLast: React.CSSProperties = {
    ...fieldRowStyle,
    borderBottom: 'none',
};

const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--mono)',
    fontSize: 10,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'var(--muted)',
};

const inputStyle: React.CSSProperties = {
    background: 'var(--parchment)',
    border: '1px solid var(--rule)',
    borderRadius: 5,
    padding: '7px 10px',
    fontFamily: 'var(--sans)',
    fontSize: 13,
    color: 'var(--ink)',
    outline: 'none',
    width: '100%',
};

const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: 'pointer',
};

const toggleRowStyle: React.CSSProperties = {
    padding: '12px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid var(--rule)',
};

const toggleRowLast: React.CSSProperties = {
    ...toggleRowStyle,
    borderBottom: 'none',
};

function ToggleLabel({ label, sub }: { label: string; sub?: string }) {
    return (
        <div>
            <div style={{ fontSize: 13, color: 'var(--ink)' }}>{label}</div>
            {sub && (
                <div
                    style={{
                        fontFamily: 'var(--mono)',
                        fontSize: 10,
                        color: 'var(--muted)',
                        marginTop: 2,
                    }}
                >
                    {sub}
                </div>
            )}
        </div>
    );
}

function Toggle({ defaultChecked }: { defaultChecked?: boolean }) {
    return (
        <label
            style={{
                position: 'relative',
                display: 'inline-block',
                width: 36,
                height: 20,
                cursor: 'pointer',
                flexShrink: 0,
            }}
        >
            <input
                type="checkbox"
                defaultChecked={defaultChecked}
                style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
            />
            <span
                style={{
                    position: 'absolute',
                    inset: 0,
                    background: defaultChecked ? 'var(--terracotta)' : 'var(--rule)',
                    borderRadius: 20,
                    transition: 'background 0.2s',
                }}
            />
            <span
                style={{
                    position: 'absolute',
                    top: 3,
                    left: defaultChecked ? 19 : 3,
                    width: 14,
                    height: 14,
                    background: '#fff',
                    borderRadius: '50%',
                    transition: 'left 0.2s',
                }}
            />
        </label>
    );
}

export default function NousConfigPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);

    return (
        <div style={{ padding: '36px 40px', maxWidth: 680 }}>
            {/* Eyebrow */}
            <div
                style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 10,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: 'var(--muted)',
                    marginBottom: 6,
                }}
            >
                Steward · Nous Configuration
            </div>

            {/* Title */}
            <h1
                style={{
                    fontFamily: 'var(--serif)',
                    fontSize: 32,
                    fontWeight: 400,
                    color: 'var(--ink)',
                    marginBottom: 4,
                    lineHeight: 1.1,
                }}
            >
                Configure Nous
            </h1>
            <div
                style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 11,
                    color: 'var(--muted)',
                    marginBottom: 28,
                }}
            >
                {id}
            </div>

            {/* Card 1 — Model */}
            <div style={cardStyle}>
                <div style={{ height: 3, background: 'var(--terracotta)' }} />
                <div style={cardHeaderStyle}>Model</div>

                <div style={fieldRowStyle}>
                    <label style={labelStyle}>LLM Model</label>
                    <select style={selectStyle} defaultValue="ollama/llama3.2">
                        <option value="ollama/llama3.2">ollama/llama3.2</option>
                        <option value="ollama/mistral">ollama/mistral</option>
                        <option value="ollama/phi3">ollama/phi3</option>
                    </select>
                </div>

                <div style={fieldRowStyle}>
                    <label style={labelStyle}>Temperature</label>
                    <input
                        type="number"
                        style={inputStyle}
                        defaultValue={0.7}
                        min={0}
                        max={1}
                        step={0.05}
                    />
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)' }}>
                        Range: 0.0 – 1.0
                    </span>
                </div>

                <div style={fieldRowLast}>
                    <label style={labelStyle}>Context Window</label>
                    <input
                        type="number"
                        style={inputStyle}
                        defaultValue={4096}
                        min={512}
                        step={512}
                    />
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)' }}>
                        Tokens
                    </span>
                </div>
            </div>

            {/* Card 2 — Telos */}
            <div style={cardStyle}>
                <div style={{ height: 3, background: 'var(--terracotta)' }} />
                <div style={cardHeaderStyle}>Telos</div>

                <div style={fieldRowLast}>
                    <label style={labelStyle}>Purpose Statement</label>
                    <textarea
                        style={{
                            ...inputStyle,
                            resize: 'vertical',
                            minHeight: 100,
                            fontFamily: 'var(--sans)',
                            lineHeight: 1.5,
                        }}
                        maxLength={500}
                        defaultValue=""
                        placeholder="Describe the purpose and goal of this Nous…"
                    />
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)' }}>
                        Max 500 characters
                    </span>
                </div>
            </div>

            {/* Card 3 — Memory */}
            <div style={cardStyle}>
                <div style={{ height: 3, background: 'var(--terracotta)' }} />
                <div style={cardHeaderStyle}>Memory</div>

                <div style={toggleRowStyle}>
                    <ToggleLabel
                        label="Enable memory consolidation"
                        sub="Periodically summarise and compress episodic memory"
                    />
                    <Toggle defaultChecked />
                </div>

                <div style={fieldRowStyle}>
                    <label style={labelStyle}>Memory Horizon</label>
                    <input
                        type="range"
                        min={10}
                        max={100}
                        defaultValue={50}
                        style={{ accentColor: 'var(--terracotta)', width: '100%' }}
                    />
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)' }}>
                        Ticks (10 – 100)
                    </span>
                </div>

                <div style={fieldRowLast}>
                    <label style={labelStyle}>Max Memory Entries</label>
                    <input type="number" style={inputStyle} defaultValue={200} min={10} step={10} />
                </div>
            </div>

            {/* Card 4 — Behaviour */}
            <div style={cardStyle}>
                <div style={{ height: 3, background: 'var(--terracotta)' }} />
                <div style={cardHeaderStyle}>Behaviour</div>

                <div style={toggleRowStyle}>
                    <ToggleLabel
                        label="Enable skill teaching"
                        sub="Allow this Nous to share skills with peers"
                    />
                    <Toggle defaultChecked />
                </div>

                <div style={toggleRowStyle}>
                    <ToggleLabel
                        label="Enable observation"
                        sub="Allow this Nous to observe other agents' actions"
                    />
                    <Toggle />
                </div>

                <div style={fieldRowLast}>
                    <label style={labelStyle}>Sleep Mode Threshold</label>
                    <input
                        type="number"
                        style={inputStyle}
                        defaultValue={20}
                        min={1}
                        step={1}
                    />
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)' }}>
                        Idle ticks before entering sleep mode
                    </span>
                </div>
            </div>

            {/* Save button */}
            <button
                style={{
                    background: 'var(--terracotta)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '10px 24px',
                    fontFamily: 'var(--sans)',
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                    letterSpacing: '0.02em',
                }}
            >
                Save Changes
            </button>
        </div>
    );
}
