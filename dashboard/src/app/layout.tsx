import './globals.css';
import type { ReactNode } from 'react';
import { AgencyIndicator } from '@/components/agency/agency-indicator';
import { AgencyHydrator } from '@/components/agency/agency-hydrator';

export const metadata = {
    title: 'Noēsis / grid',
    description: 'Noēsis dashboard — live Grid observation',
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en" className="dark">
            <body className="min-h-screen bg-neutral-950 text-neutral-100 antialiased">
                <AgencyHydrator />
                <div className="fixed right-4 top-4 z-50">
                    <AgencyIndicator />
                </div>
                {children}
            </body>
        </html>
    );
}
