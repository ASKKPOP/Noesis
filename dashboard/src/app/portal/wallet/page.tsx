/**
 * /portal/wallet — Phase 23 Cyber Coin Wallet.
 * Client-only (wagmi hooks).
 */

import dynamic from 'next/dynamic';

const WalletPanel = dynamic(
    () => import('@/components/portal/WalletPanel').then(m => ({ default: m.WalletPanel })),
    { ssr: false },
);

export default function WalletPage() {
    return <WalletPanel />;
}
