'use client';
import { useState, useEffect } from 'react';

interface SkillEntry {
    skill_hash: string;
    name: string;
    description: string;
    source: 'taught' | 'inferred';
    teacher_did: string | null;
    tick: number;
}

interface SkillsTabProps {
    nousId: string;
}

const badgeBase: React.CSSProperties = {
    fontFamily: 'var(--mono-portal)',
    fontSize: 13,
    fontWeight: 600,
    padding: '2px 6px',
    borderRadius: 4,
    border: '1px solid var(--rule)',
    background: 'var(--parchment)',
    color: 'var(--muted)',
    whiteSpace: 'nowrap',
};

function SkillRow({ skill, isLast }: { skill: SkillEntry; isLast: boolean }) {
    const isHash = skill.name.endsWith('...');
    const sourceLabel = skill.source === 'taught'
        ? 'TAUGHT BY ' + (skill.teacher_did?.split(':').pop()?.toUpperCase() ?? 'NOUS')
        : 'SELF-INFERRED';

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '13px 0',
            borderBottom: isLast ? 'none' : '1px solid var(--rule)',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={badgeBase}>{sourceLabel}</span>
                {isHash ? (
                    <span style={{
                        fontFamily: 'var(--mono-portal)',
                        fontSize: 13,
                        color: 'var(--muted)',
                    }}>
                        {skill.name}
                    </span>
                ) : (
                    <span style={{
                        fontFamily: 'var(--sans-portal)',
                        fontSize: 16,
                        fontWeight: 400,
                        color: 'var(--ink)',
                    }}>
                        {skill.name}
                    </span>
                )}
            </div>
            <span style={{
                fontFamily: 'var(--mono-portal)',
                fontSize: 13,
                fontWeight: 400,
                color: 'var(--muted)',
                flexShrink: 0,
                marginLeft: 12,
            }}>
                T{skill.tick.toLocaleString()}
            </span>
        </div>
    );
}

export default function SkillsTab({ nousId }: SkillsTabProps) {
    const [skills, setSkills] = useState<SkillEntry[]>([]);
    const [loading, setLoading] = useState(true);

    const gridBase = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

    useEffect(() => {
        setLoading(true);
        fetch(`${gridBase}/api/v1/portal/nous/${nousId}/skills`, { credentials: 'include' })
            .then(r => r.ok ? r.json() : { skills: [] })
            .then((data: { skills: SkillEntry[] }) => {
                setSkills(data.skills ?? []);
            })
            .catch(() => setSkills([]))
            .finally(() => setLoading(false));
    }, [nousId, gridBase]);

    if (loading) {
        return (
            <div>
                {[0, 1, 2].map(i => (
                    <div
                        key={i}
                        style={{
                            background: 'var(--parchment-2)',
                            borderRadius: 4,
                            height: 20,
                            animation: 'portal-pulse 1.2s infinite',
                            marginBottom: 8,
                        }}
                    />
                ))}
            </div>
        );
    }

    if (skills.length === 0) {
        return (
            <div style={{
                fontFamily: 'var(--sans-portal)',
                fontSize: 16,
                fontWeight: 400,
                color: 'var(--muted)',
                textAlign: 'center',
                padding: '32px 0',
            }}>
                No skills recorded yet.
            </div>
        );
    }

    return (
        <div>
            {skills.map((skill, idx) => (
                <SkillRow
                    key={skill.skill_hash}
                    skill={skill}
                    isLast={idx === skills.length - 1}
                />
            ))}
        </div>
    );
}
