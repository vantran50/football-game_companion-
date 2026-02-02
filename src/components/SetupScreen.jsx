import { useGame } from '../context/GameContext';

export default function SetupScreen() {
    const { state, startDraft, forceAdmin } = useGame();

    // If I'm not admin, show waiting
    if (!state.isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center h-[80vh] bg-slate-800 rounded-xl m-4 border border-slate-700 animate-in fade-in">
                <div className="text-6xl mb-4">⏳</div>
                <h2 className="text-2xl font-bold">Waiting for Host</h2>
                <p className="text-slate-400 mt-2">The commissioner is setting up the draft.</p>
                <div className="mt-8 px-4 py-2 bg-slate-900 rounded-lg border border-slate-700 font-mono">
                    Room: {state.roomCode}
                </div>
                <button
                    onClick={() => {
                        if (confirm("Are you sure you are the Host? This will force Admin controls.")) {
                            forceAdmin();
                            window.location.reload();
                        }
                    }}
                    className="mt-8 text-slate-600 text-xs underline hover:text-slate-400"
                >
                    (Stuck? Recover Host Session)
                </button>
            </div>
        );
    }

    return (
        <div className="p-4 space-y-6">
            <h2 className="text-2xl font-bold">Room Setup</h2>
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <h3 className="font-bold mb-4">Participants</h3>
                <div className="space-y-2 mb-4">
                    {state.participants.length === 0 && <p className="text-slate-500 text-sm">No players yet.</p>}
                    {state.participants.map(p => (
                        <div key={p.id} className="flex justify-between items-center bg-slate-900 p-3 rounded">
                            <span>{p.name}</span>
                            <span className="text-xs bg-slate-800 px-2 py-1 rounded">{p.isAdmin ? 'Commissioner' : 'Player'}</span>
                        </div>
                    ))}
                </div>

                {/* Admin Join Option */}
                {state.isAdmin && !state.participants.find(p => p.id === state.myId) && (
                    <div className="mb-4 p-3 bg-blue-900/20 border border-blue-800 rounded-lg">
                        <p className="text-sm text-blue-200 mb-2">You are hosting but not playing.</p>
                        <button
                            onClick={() => window.location.reload()} // Simplified: Just reload to see Join Screen or...
                        // Actually better: call joinRoom function? But joinRoom asks for code.
                        // Let's just use window.location.reload() to clear state? No that loses admin.
                        // Context doesn't expose joinRoom easily here for *self* if we already have identity.
                        // Wait, if I am Admin I have identity 'HOST'.
                        // If I join room, I get new Identity.
                        // Let's just tell them to open new tab? Or provide a specific "Join as Player" action in Context?
                        // Simpler: Just tell them to "Join Game" via the code input if they want to play?
                        // Or better: Just render the Join Input here?
                        >
                            {/* Let's keep it simple. Admin = Host. If they want to play, they should use a different specific flow or just "Add Participant". */}
                            {/* User said "Admin participant is auto created - we do not want this". */}
                            {/* Implies they might want to ADD themselves manually. */}
                        </button>
                        <p className="text-xs text-slate-500">To play, join with code <strong>{state.roomCode}</strong> in a new tab or browser.</p>
                    </div>
                )}
            </div>

            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <button
                    onClick={startDraft}
                    className="w-full py-4 bg-green-600 hover:bg-green-500 font-bold rounded-lg text-lg shadow-lg shadow-green-900/20"
                >
                    START DRAFT
                </button>
            </div>
        </div>
    );
}
