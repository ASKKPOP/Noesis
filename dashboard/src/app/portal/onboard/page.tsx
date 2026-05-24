'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useHumanAuthStore } from '@/lib/stores/human-auth-store';
import WizardStepIndicator from './WizardStepIndicator';
import StepWelcome from './StepWelcome';
import StepSophiaChat from './StepSophiaChat';
import StepWorldTour from './StepWorldTour';

const CyberGridBg = dynamic(() => import('@/components/portal/CyberGrid'), { ssr: false });

const GRID_BASE = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

type DistrictId = 'AI_CORE' | 'HUB' | 'DATA' | 'DARKWEB' | 'RESIDENTIAL';

const DISTRICT_ORDER: readonly DistrictId[] = ['AI_CORE', 'HUB', 'DATA', 'DARKWEB', 'RESIDENTIAL'] as const;

function PortalOnboardPage() {
    const router = useRouter();
    const { currentUser, setUser } = useHumanAuthStore();
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [currentDistrict, setCurrentDistrict] = useState<DistrictId | null>(null);

    // Guard: already onboarded — go to portal
    useEffect(() => {
        if (currentUser?.onboarded === true) {
            router.replace('/portal');
        }
    }, [currentUser, router]);

    const handleSophiaDone = useCallback(async (lastUserMessage: string) => {
        // D-08: store goal non-blocking, then advance to step 3
        try {
            await fetch(`${GRID_BASE}/api/v1/portal/auth/me`, {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ onboarding_goal: lastUserMessage || 'Exploring Noēsis' }),
            });
        } catch (err) {
            console.warn('[onboard] goal storage failed (non-blocking):', err);
        }
        setStep(3);
    }, []);

    const handleWizardComplete = useCallback(() => {
        // Update store so redirect guard doesn't fire again
        if (currentUser) {
            setUser({ ...currentUser, onboarded: true });
        }
        router.push('/portal');
    }, [currentUser, router, setUser]);

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
                {step === 2 && <StepSophiaChat onDone={handleSophiaDone} />}
                {step === 3 && (
                    <StepWorldTour
                        districtOrder={DISTRICT_ORDER}
                        onDistrictChange={setCurrentDistrict}
                        onComplete={handleWizardComplete}
                    />
                )}
            </div>
        </div>
    );
}

export default dynamic(() => Promise.resolve({ default: PortalOnboardPage }), { ssr: false });
