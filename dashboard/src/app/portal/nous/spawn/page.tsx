'use client';
import dynamic from 'next/dynamic';

const SpawnWizardClient = dynamic(() => import('./SpawnWizardClient'), { ssr: false });

export default function SpawnNousPage() {
    return <SpawnWizardClient />;
}
