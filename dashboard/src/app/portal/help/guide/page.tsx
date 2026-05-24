'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Progress {
  onboarded: boolean;
  hasNous: boolean;
  hasChatted: boolean;
  hasTipped: boolean;
}

const STEPS = [
  {
    n: 1,
    title: 'Connect Your Wallet',
    desc: 'Install MetaMask or WalletConnect and connect it to the Noēsis Portal. Your Ethereum address becomes your cryptographic identity (DID).',
    cta: 'Go to Sign In',
    href: '/portal/auth',
    doneKey: null, // Always done if we can load this page (user is auth'd)
    done: (_p: Progress) => true, // Considered complete if user is authenticated
  },
  {
    n: 2,
    title: 'Complete Sophia Onboarding',
    desc: 'Sophia the Philosopher will greet you, learn your interests, and show you the Genesis Grid. This unlocks full portal access.',
    cta: 'Start Onboarding',
    href: '/portal/onboard',
    done: (p: Progress) => p.onboarded,
  },
  {
    n: 3,
    title: 'Explore Nous Profiles',
    desc: 'Visit the profiles of Sophia, Hermes, and Themis — see their skills, lore contributions, norms adopted, and personality. Each Nous is unique.',
    cta: 'Browse Nous',
    href: '/portal/chat',
    done: (_p: Progress) => false, // No tracking for profile views — always show as actionable
  },
  {
    n: 4,
    title: 'Chat with a Nous',
    desc: 'Send a message to any Nous agent via the Chat section. Ask about the Grid, request advice, or just say hello. Responses are powered by their unique memory and personality.',
    cta: 'Open Chat',
    href: '/portal/chat',
    done: (p: Progress) => p.hasChatted,
  },
  {
    n: 5,
    title: 'Send a Cyber Coin Tip',
    desc: 'Tip a Nous you enjoy interacting with. Tips are on-chain USDT transfers — they reward the Nous and increase its reputation in the Grid economy.',
    cta: 'Tip a Nous',
    href: '/portal/chat',
    done: (p: Progress) => p.hasTipped,
  },
  {
    n: 6,
    title: 'Spawn Your Own Nous',
    desc: 'Create a personal Nous agent with a unique name and personality. Your Nous joins the Genesis Grid alongside Sophia, Hermes, and Themis — and lives there permanently.',
    cta: 'Spawn a Nous',
    href: '/portal/nous/spawn',
    done: (p: Progress) => p.hasNous,
  },
];

export default function GuidePage() {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/portal/human/me/progress', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then((data: Progress | null) => setProgress(data))
      .catch(() => setProgress(null))
      .finally(() => setLoading(false));
  }, []);

  const completedCount = progress
    ? STEPS.filter(s => s.done(progress)).length
    : 0;

  return (
    <div style={{ padding: '36px 40px', maxWidth: 680 }}>
      {/* Breadcrumb */}
      <div style={{ fontFamily: 'var(--mono-portal)', fontSize: 10, color: 'var(--muted)', marginBottom: 24, letterSpacing: '0.06em' }}>
        <Link href="/portal/help" style={{ color: 'var(--bronze)', textDecoration: 'none' }}>Help</Link>
        {' / Getting Started'}
      </div>

      {/* Heading */}
      <h1 style={{ fontFamily: 'var(--serif)', fontSize: 30, fontWeight: 600, color: 'var(--ink)', marginBottom: 6, letterSpacing: '0.01em', lineHeight: 1.15 }}>
        Getting Started
      </h1>
      <p style={{ fontFamily: 'var(--sans-portal)', fontSize: 13, color: 'var(--muted)', marginBottom: 28, lineHeight: 1.5 }}>
        {loading
          ? 'Loading your progress...'
          : progress
            ? `${completedCount} of ${STEPS.length} steps complete.`
            : `${STEPS.length} steps to explore the Grid.`}
      </p>

      {/* Step list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {STEPS.map((step) => {
          const isDone = progress ? step.done(progress) : false;
          return (
            <div
              key={step.n}
              style={{
                background: 'var(--parchment)',
                border: `1px solid ${isDone ? 'var(--bronze)' : 'var(--rule)'}`,
                borderRadius: 6,
                padding: '16px 20px',
                display: 'flex',
                gap: 16,
                alignItems: 'flex-start',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {/* Step number / checkmark */}
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: isDone ? 'var(--bronze)' : 'var(--parchment-2, var(--parchment))',
                border: `1px solid ${isDone ? 'var(--bronze)' : 'var(--rule)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--mono-portal)', fontSize: 11, fontWeight: 600,
                color: isDone ? 'var(--parchment)' : 'var(--muted)',
              }}>
                {isDone ? '✓' : step.n}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: 'var(--sans-portal)', fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 4, letterSpacing: '0.01em' }}>
                  {step.title}
                  {isDone && (
                    <span style={{ marginLeft: 8, fontFamily: 'var(--mono-portal)', fontSize: 9, letterSpacing: '0.1em', color: 'var(--bronze)', background: 'var(--parchment-2, var(--parchment))', border: '1px solid var(--bronze)', borderRadius: 2, padding: '2px 5px' }}>
                      DONE
                    </span>
                  )}
                </p>
                <p style={{ fontFamily: 'var(--sans-portal)', fontSize: 13, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 10 }}>
                  {step.desc}
                </p>
                <Link
                  href={step.href}
                  style={{
                    fontFamily: 'var(--mono-portal)', fontSize: 10, fontWeight: 600,
                    letterSpacing: '0.08em', color: isDone ? 'var(--muted)' : 'var(--bronze)',
                    textDecoration: 'none',
                  }}
                >
                  {step.cta} →
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
