import { useGame } from '../context/GameContext';

export default function LiveDashboard() {
    const { state, handleTouchdown } = useGame();

    return (
        <div className="p-4">
            <h2 className="text-2xl font-bold mb-4 bg-red-600 inline-block px-3 py-1 rounded">LIVE</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {state.participants.map(p => (
                    <div key={p.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                        <div className="flex justify-between font-bold mb-2">
                            <span>{p.name}</span>
                            <span className="text-green-400">${p.balance}</span>
                        </div>
                        <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                                <span className="text-slate-400">Home:</span>
                                <span>{p.roster.home?.map(pl => pl.name).join(', ') || '-'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Away:</span>
                                <span>{p.roster.away?.map(pl => pl.name).join(', ') || '-'}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {state.isAdmin && (
                <div className="mt-8 p-4 bg-slate-800 rounded-xl border border-red-900/50">
                    <h3 className="font-bold text-red-500 mb-4">Commissioner Controls</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={() => handleTouchdown('home')}
                            className="py-8 bg-blue-900/50 border border-blue-500 rounded-xl font-bold text-xl hover:bg-blue-900 transition"
                        >
                            TOUCHDOWN HOME
                        </button>
                        <button
                            onClick={() => handleTouchdown('away')}
                            className="py-8 bg-green-900/50 border border-green-500 rounded-xl font-bold text-xl hover:bg-green-900 transition"
                        >
                            TOUCHDOWN AWAY
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
