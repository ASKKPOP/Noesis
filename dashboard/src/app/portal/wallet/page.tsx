export default function WalletPage() {
    return (
        <div className="flex flex-col items-center justify-center gap-4 p-16 text-center">
            <div className="rounded-full bg-neutral-800 p-5">
                <svg className="h-10 w-10 text-neutral-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3" />
                </svg>
            </div>
            <h1 className="text-xl font-bold text-neutral-100">Cyber Coin Wallet</h1>
            <p className="max-w-sm text-sm text-neutral-400">
                On-chain ETH and USDT balances, send and receive Cyber Coin, and transaction history — arriving in Phase 23.
            </p>
            <span className="rounded-full bg-neutral-800 px-4 py-1.5 text-xs font-medium text-neutral-500">Phase 23</span>
        </div>
    );
}
