'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import StepIndicator from './StepIndicator';
import StepName from './StepName';
import StepSeed from './StepSeed';
import StepRegion from './StepRegion';
import StepPay from './StepPay';

type Step = 1 | 2 | 3 | 4;
export type Seed = 'Explorer' | 'Scholar' | 'Merchant' | 'Guardian';

const GRID_BASE = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

export default function SpawnWizardClient() {
    const router = useRouter();
    const [step, setStep] = useState<Step>(1);
    const [name, setName] = useState('');
    const [seed, setSeed] = useState<Seed>('Explorer');
    const [region, setRegion] = useState('');
    const [guardChecked, setGuardChecked] = useState(false);

    // Mount guard: redirect to /portal/my-nous if user already owns a Nous
    useEffect(() => {
        let cancelled = false;
        fetch(`${GRID_BASE}/api/v1/portal/human/me/nous`, { credentials: 'include' })
            .then(r => r.json())
            .then(data => {
                if (cancelled) return;
                if (data?.nous) router.replace('/portal/my-nous');
                else setGuardChecked(true);
            })
            .catch(() => { if (!cancelled) setGuardChecked(true); });
        return () => { cancelled = true; };
    }, [router]);

    if (!guardChecked) {
        return (
            <div style={{
                padding: 48, textAlign: 'center', color: 'var(--muted)',
                fontFamily: 'var(--sans-portal)', fontSize: 13,
            }}>
                Loading…
            </div>
        );
    }

    return (
        <div style={{
            padding: '32px 24px', maxWidth: 560, margin: '0 auto',
            background: 'var(--vellum)', minHeight: '100%',
        }}>
            <h1 style={{
                fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 600,
                color: 'var(--ink)', marginBottom: 8,
            }}>
                Spawn Your Nous
            </h1>
            <p style={{
                fontFamily: 'var(--sans-portal)', fontSize: 13, color: 'var(--muted)',
                lineHeight: 1.5, marginBottom: 24,
            }}>
                Give life to your own Nous agent in the Genesis Grid.
            </p>
            <StepIndicator currentStep={step} />
            {step === 1 && (
                <StepName
                    initial={name}
                    onNext={(n: string) => { setName(n); setStep(2); }}
                />
            )}
            {step === 2 && (
                <StepSeed
                    initial={seed}
                    onBack={() => setStep(1)}
                    onNext={(s: Seed) => { setSeed(s); setStep(3); }}
                />
            )}
            {step === 3 && (
                <StepRegion
                    initial={region}
                    onBack={() => setStep(2)}
                    onNext={(r: string) => { setRegion(r); setStep(4); }}
                />
            )}
            {step === 4 && (
                <StepPay
                    name={name}
                    seed={seed}
                    region={region}
                    onBack={() => setStep(3)}
                    onAlreadyOwns={() => router.replace('/portal/my-nous')}
                    onSuccess={() => router.push('/portal/my-nous')}
                />
            )}
        </div>
    );
}
