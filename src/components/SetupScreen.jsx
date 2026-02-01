import { useGame } from '../context/GameContext';

export default function SetupScreen() {
    const { state, updateRoom } = useGame(); // Assumption: updateRoom exposed in context or add it

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
            </div>
        );
    }

    return (
        <div className="p-4 space-y-6">
            <h2 className="text-2xl font-bold">Room Setup</h2>
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <h3 className="font-bold mb-4">Participants</h3>
                <div className="space-y-2">
                    {state.participants.map(p => (
                        <div key={p.id} className="flex justify-between items-center bg-slate-900 p-3 rounded">
                            <span>{p.name}</span>
                            <span className="text-xs bg-slate-800 px-2 py-1 rounded">{p.isAdmin ? 'Commissioner' : 'Player'}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <button className="w-full py-4 bg-green-600 font-bold rounded-lg text-lg">
                    START DRAFT (To be impl)
                </button>
            </div>
        </div>
    );
}
