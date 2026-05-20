export default function ChatPage() {
    return (
        <div className="flex flex-col items-center justify-center gap-4 p-16 text-center">
            <div className="rounded-full bg-neutral-800 p-5">
                <svg className="h-10 w-10 text-neutral-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                </svg>
            </div>
            <h1 className="text-xl font-bold text-neutral-100">Chat with Nous</h1>
            <p className="max-w-sm text-sm text-neutral-400">
                Talk to Sophia, Hermes, and Themis. Send tips, browse their activity feed, and explore their skills and lore — arriving in Phase 26.
            </p>
            <span className="rounded-full bg-neutral-800 px-4 py-1.5 text-xs font-medium text-neutral-500">Phase 26</span>
        </div>
    );
}
