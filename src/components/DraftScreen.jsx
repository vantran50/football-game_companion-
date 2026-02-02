import { useGame } from '../context/GameContext';
import { useState } from 'react';

export default function DraftScreen({ isCatchUp = false }) {
    const { state, makePick, startGame } = useGame();
    const [tab, setTab] = useState('home'); // home | away
    const [pickingId, setPickingId] = useState(null); // Lock UI during pick

    // Determine my draft needs
    const me = state.participants.find(p => p.id === state.myId);
    const hasHome = me?.roster.home?.length > 0;
    const hasAway = me?.roster.away?.length > 0;

    // Filter available players
    const players = state.availablePlayers[tab] || [];

    const handlePick = async (player) => {
        if (pickingId) return; // Prevent double click

        // Enforce 1 player per side limit
        if (tab === 'home' && hasHome) { alert("You already have a Home player."); return; }
        if (tab === 'away' && hasAway) { alert("You already have an Away player."); return; }

        if (confirm(`Draft ${player.name}?`)) {
            setPickingId(player.id);
            const success = await makePick(player, tab);
            setPickingId(null);

            // Auto-switch tab if successful and needed
            if (success) {
                if (tab === 'home' && !hasAway) setTab('away');
                if (tab === 'away' && !hasHome) setTab('home');
            }
        }
    };

    return (
        <div className="p-4 flex flex-col h-full">
            <h2 className="text-xl font-bold mb-4">
                {isCatchUp ? 'Late Draft' : 'Draft Board'}
            </h2>

            {/* Tabs */}
            <div className="flex bg-slate-800 rounded-lg p-1 mb-4">
                <button
                    onClick={() => setTab('home')}
                    disabled={!!pickingId}
                    className={`flex-1 py-3 rounded-md font-bold transition ${tab === 'home' ? 'bg-blue-600 shadow' : 'text-slate-400'} disabled:opacity-50`}
                >
                    HOME {hasHome && '✓'}
                </button>
                <button
                    onClick={() => setTab('away')}
                    disabled={!!pickingId}
                    className={`flex-1 py-3 rounded-md font-bold transition ${tab === 'away' ? 'bg-green-600 shadow' : 'text-slate-400'} disabled:opacity-50`}
                >
                    AWAY {hasAway && '✓'}
                </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto space-y-2 pb-20">
                {players.length === 0 && <div className="text-center text-slate-500 py-10">No players available</div>}

                {players.map(p => {
                    const isSideFull = (tab === 'home' && hasHome) || (tab === 'away' && hasAway);

                    return (
                        <button
                            key={p.id}
                            onClick={() => handlePick(p)}
                            disabled={!!pickingId || isSideFull}
                            className={`w-full flex justify-between items-center bg-slate-800 p-4 rounded-xl border border-slate-700 hover:border-blue-500 hover:bg-slate-700 transition group disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            <div className="text-left">
                                <div className="font-bold text-lg group-hover:text-blue-400">
                                    {pickingId === p.id ? 'Drafting...' : p.name}
                                </div>
                                <div className="text-xs text-slate-400">{p.pos} #{p.num}</div>
                            </div>
                            <div className="bg-slate-900 px-3 py-1 rounded text-xs font-bold text-slate-300">
                                {pickingId === p.id ? '...' : (isSideFull ? 'FULL' : 'DRAFT')}
                            </div>
                        </button>
                    )
                })}
            </div>

            {/* Status Footer */}
            {isCatchUp && (
                <div className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-700 p-4 text-center text-xs text-slate-400">
                    Draft 1 player from each team to join the live game.
                </div>
            )}

            {/* Admin Start Game (Only in Main Draft) */}
            {!isCatchUp && state.isAdmin && (
                <div className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-700 p-4">
                    <button
                        onClick={startGame}
                        className="w-full py-4 bg-red-600 hover:bg-red-500 font-bold rounded-lg text-white shadow-lg shadow-red-900/20"
                    >
                        START GAME
                    </button>
                </div>
            )}
        </div>
    );
}
