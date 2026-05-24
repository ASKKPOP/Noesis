'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const SUBJECTS = ['Bug Report', 'Feature Request', 'Account Issue', 'Payment Issue', 'Other'] as const;
type Subject = typeof SUBJECTS[number];

interface Ticket {
  id: string;
  subject: string;
  status: 'open' | 'closed';
  created_at: string;
}

export default function ContactPage() {
  const [subject, setSubject] = useState<Subject>('Bug Report');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);

  // Fetch user's existing tickets on mount
  useEffect(() => {
    fetch('/api/v1/portal/support/tickets', { credentials: 'include' })
      .then(r => r.ok ? r.json() : { tickets: [] })
      .then((data: { tickets: Ticket[] }) => setTickets(data.tickets))
      .catch(() => setTickets([]))
      .finally(() => setTicketsLoading(false));
  }, [successId]); // Re-fetch after successful submit

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (message.trim().length === 0) {
      setSubmitError('Please enter a message.');
      return;
    }
    if (message.trim().length > 1000) {
      setSubmitError('Message must be 1000 characters or fewer.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/portal/support/tickets', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, message: message.trim() }),
      });
      const data = await res.json() as { id?: string; error?: string };
      if (!res.ok) {
        setSubmitError(data.error ?? 'Submission failed. Please try again.');
        return;
      }
      setSuccessId(data.id ?? null);
      setMessage('');
    } catch {
      setSubmitError('Network error. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '36px 40px', maxWidth: 680 }}>
      {/* Breadcrumb */}
      <div style={{ fontFamily: 'var(--mono-portal)', fontSize: 10, color: 'var(--muted)', marginBottom: 24, letterSpacing: '0.06em' }}>
        <Link href="/portal/help" style={{ color: 'var(--bronze)', textDecoration: 'none' }}>Help</Link>
        {' / Contact Support'}
      </div>

      {/* Heading */}
      <h1 style={{ fontFamily: 'var(--serif)', fontSize: 30, fontWeight: 600, color: 'var(--ink)', marginBottom: 6, letterSpacing: '0.01em', lineHeight: 1.15 }}>
        Contact Support
      </h1>
      <p style={{ fontFamily: 'var(--sans-portal)', fontSize: 13, color: 'var(--muted)', marginBottom: 28, lineHeight: 1.5 }}>
        Report a bug, request a feature, or get help with your account. We review every ticket.
      </p>

      {/* Success banner */}
      {successId && (
        <div style={{
          background: 'var(--parchment)', border: '1px solid var(--bronze)', borderRadius: 4,
          padding: '12px 18px', marginBottom: 24,
          fontFamily: 'var(--sans-portal)', fontSize: 13, color: 'var(--bronze)',
        }}>
          Ticket submitted — ID: <span style={{ fontFamily: 'var(--mono-portal)', fontSize: 11 }}>{successId}</span>. We will follow up via email.
        </div>
      )}

      {/* Ticket form */}
      <form onSubmit={handleSubmit} style={{ marginBottom: 40 }}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontFamily: 'var(--mono-portal)', fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 6 }}>
            Subject
          </label>
          <select
            value={subject}
            onChange={e => setSubject(e.target.value as Subject)}
            style={{
              width: '100%', padding: '9px 12px', borderRadius: 4,
              border: '1px solid var(--rule)', background: 'var(--parchment)',
              color: 'var(--ink)', fontFamily: 'var(--sans-portal)', fontSize: 13,
            }}
          >
            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontFamily: 'var(--mono-portal)', fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 6 }}>
            Message
          </label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            maxLength={1000}
            rows={6}
            placeholder="Describe the issue or request in detail..."
            style={{
              width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 4,
              border: '1px solid var(--rule)', background: 'var(--parchment)',
              color: 'var(--ink)', fontFamily: 'var(--sans-portal)', fontSize: 13,
              lineHeight: 1.6, resize: 'vertical',
            }}
          />
          <div style={{ fontFamily: 'var(--mono-portal)', fontSize: 10, color: 'var(--muted)', marginTop: 4, textAlign: 'right', letterSpacing: '0.04em' }}>
            {message.length}/1000
          </div>
        </div>

        {/* Screenshot note — D-14: file upload deferred */}
        <p style={{ fontFamily: 'var(--sans-portal)', fontSize: 12, color: 'var(--muted)', marginBottom: 16, fontStyle: 'italic' }}>
          Screenshot upload coming soon. For now, paste image URLs or describe visuals in the message.
        </p>

        {submitError && (
          <p style={{ fontFamily: 'var(--sans-portal)', fontSize: 13, color: '#c0392b', marginBottom: 12 }}>
            {submitError}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: '10px 24px', borderRadius: 4, border: 'none', cursor: submitting ? 'not-allowed' : 'pointer',
            background: submitting ? 'var(--muted)' : 'var(--bronze)',
            color: 'var(--parchment)', fontFamily: 'var(--mono-portal)', fontSize: 11,
            fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
          }}
        >
          {submitting ? 'Submitting...' : 'Submit Ticket'}
        </button>
      </form>

      {/* Ticket history */}
      <div>
        <div style={{ fontFamily: 'var(--mono-portal)', fontSize: 9, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 12 }}>
          Your Tickets
        </div>
        {ticketsLoading ? (
          <p style={{ fontFamily: 'var(--sans-portal)', fontSize: 13, color: 'var(--muted)' }}>Loading...</p>
        ) : tickets.length === 0 ? (
          <p style={{ fontFamily: 'var(--sans-portal)', fontSize: 13, color: 'var(--muted)' }}>No tickets yet.</p>
        ) : (
          <div style={{ background: 'var(--parchment)', border: '1px solid var(--rule)', borderRadius: 6, overflow: 'hidden' }}>
            {tickets.map((t, i) => (
              <div
                key={t.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16, padding: '12px 20px',
                  borderBottom: i < tickets.length - 1 ? '1px solid var(--rule)' : 'none',
                }}
              >
                <span style={{
                  fontFamily: 'var(--mono-portal)', fontSize: 9, fontWeight: 600,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: t.status === 'open' ? 'var(--bronze)' : 'var(--muted)',
                  background: 'var(--parchment-2, var(--parchment))',
                  border: '1px solid var(--rule)', borderRadius: 2, padding: '2px 6px',
                  flexShrink: 0,
                }}>
                  {t.status}
                </span>
                <span style={{ flex: 1, fontFamily: 'var(--sans-portal)', fontSize: 13, color: 'var(--ink)' }}>
                  {t.subject}
                </span>
                <span style={{ fontFamily: 'var(--mono-portal)', fontSize: 10, color: 'var(--muted)', letterSpacing: '0.04em', flexShrink: 0 }}>
                  {new Date(t.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
