'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useHumanAuthStore } from '@/lib/stores/human-auth-store';
import WizardStepIndicator from './WizardStepIndicator';
import StepWelcome from './StepWelcome';
import StepRegistrationGuide from './StepRegistrationGuide';
import StepWorldTour from './StepWorldTour';
import StepNextActions from './StepNextActions';

const CyberGridBg = dynamic(() => import('@/components/portal/CyberGrid'), { ssr: false });

const GRID_BASE = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

type DistrictId = 'AI_CORE' | 'HUB' | 'DATA' | 'DARKWEB' | 'RESIDENTIAL';

const DISTRICT_ORDER: readonly DistrictId[] = ['AI_CORE', 'HUB', 'DATA', 'DARKWEB', 'RESIDENTIAL'] as const;

/** Default goal stored on quick-start skip (D-06 superseded 2026-06-10). */
const DEFAULT_GOAL = 'Exploring Noēsis';

function PortalOnboardPage() {
    const router = useRouter();
    const { currentUser, setUser } = useHumanAuthStore();
    const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
    const [currentDistrict, setCurrentDistrict] = useState<DistrictId | null>(null);
    const [completing, setCompleting] = useState(false);

    // Guard: already onboarded — go to portal
    useEffect(() => {
        if (currentUser?.onboarded === true) {
            router.replace('/portal');
        }
    }, [currentUser, router]);

    /**
     * Complete onboarding: store the goal (D-08: non-blocking — the PATCH is what
     * makes /me return onboarded:true per D-12), mark the store, navigate.
     * Used by both the step-4 actions and the quick-start skip link.
     */
    const completeOnboarding = useCallback(async (goal: string, dest: string) => {
        if (completing) return;
        setCompleting(true);
        try {
            await fetch(`${GRID_BASE}/api/v1/portal/auth/me`, {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ onboarding_goal: goal }),
            });
        } catch (err) {
            console.warn('[onboard] goal storage failed (non-blocking):', err);
        }
        // Update store so the redirect guard doesn't bounce back here
        if (currentUser) {
            setUser({ ...currentUser, onboarded: true });
        }
        router.push(dest);
    }, [completing, currentUser, router, setUser]);

    const handleTourComplete = useCallback(() => {
        setCurrentDistrict(null);
        setStep(4);
    }, []);

    return (
        <div style={{
            position: 'relative', minHeight: '100vh', background: '#020610',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '48px 20px',
        }}>
            {/* Layer 0: CyberGrid canvas */}
            <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
                <CyberGridBg highlightDistrict={currentDistrict} hideHud={true} />
            </div>
            {/* Layer 1: dark veil */}
            <div style={{
                position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none',
                background: step === 3 ? 'rgba(2,6,16,0.40)' : 'rgba(2,6,16,0.52)',
            }} />
            {/* Layer 2: wizard content */}
            <div style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: 520 }}>
                <WizardStepIndicator currentStep={step} />
                {step === 1 && <StepWelcome onContinue={() => setStep(2)} />}
                {step === 2 && <StepRegistrationGuide onContinue={() => setStep(3)} />}
                {step === 3 && (
                    <StepWorldTour
                        districtOrder={DISTRICT_ORDER}
                        onDistrictChange={setCurrentDistrict}
                        onComplete={handleTourComplete}
                    />
                )}
                {step === 4 && (
                    <StepNextActions onChoose={completeOnboarding} busy={completing} />
                )}

                {/* Quick start — always available before the final step (D-11 superseded 2026-06-10) */}
                {step < 4 && (
                    <div style={{ textAlign: 'center', marginTop: 16 }}>
                        <button
                            onClick={() => completeOnboarding(DEFAULT_GOAL, '/portal')}
                            disabled={completing}
                            style={{
                                background: 'none', border: 'none', padding: 4,
                                fontFamily: 'var(--sans-portal)', fontSize: 13,
                                color: 'rgba(245,240,234,0.55)',
                                cursor: completing ? 'wait' : 'pointer',
                                textDecoration: 'underline', textUnderlineOffset: 3,
                            }}
                        >
                            {completing ? 'Entering…' : 'Skip the guide — browse as visitor →'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default dynamic(() => Promise.resolve({ default: PortalOnboardPage }), { ssr: false });
