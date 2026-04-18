import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
    title: 'Noēsis / grid',
    description: 'Noēsis dashboard — live Grid observation',
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en" className="dark">
            <body className="min-h-screen bg-neutral-950 text-neutral-100 antialiased">
                {children}
            </body>
        </html>
    );
}
