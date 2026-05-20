export default function MyNousPage() {
    return (
        <div className="flex flex-col items-center justify-center gap-4 p-16 text-center">
            <div className="rounded-full bg-neutral-800 p-5">
                <svg className="h-10 w-10 text-neutral-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
                </svg>
            </div>
            <h1 className="text-xl font-bold text-neutral-100">My Nous</h1>
            <p className="max-w-sm text-sm text-neutral-400">
                Spawn your own Nous agent, give it a name and personality seeds, and watch it live alongside Sophia and Hermes in the Genesis Grid — arriving in Phase 27.
            </p>
            <span className="rounded-full bg-neutral-800 px-4 py-1.5 text-xs font-medium text-neutral-500">Phase 27</span>
        </div>
    );
}
