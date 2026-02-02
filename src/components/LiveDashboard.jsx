import { useGame } from '../context/GameContext';
import { useState } from 'react';

export default function LiveDashboard() {
    const { state, handleTouchdown, adminAssignPlayer } = useGame();

    const [assigning, setAssigning] = useState(null); // { pid: 'foo', team: 'home' }

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
                            {/* Home Roster */}
                            <div className="flex justify-between items-center group">
                                <span className="text-slate-400 w-12">Home:</span>
                                <div className="flex-1 text-right">
                                    {(p.roster.home && p.roster.home.length > 0) ? (
                                        <span>{p.roster.home.map(pl => pl.name).join(', ')}</span>
                                    ) : (
                                        state.isAdmin ? (
                                            <button
                                                onClick={() => setAssigning({ pid: p.id, team: 'home' })}
                                                className="text-xs bg-blue-900 text-blue-300 px-2 py-1 rounded hover:bg-blue-800"
                                            >
                                                + Assign
                                            </button>
                                        ) : (
                                            <span className="text-slate-600 italic">Empty</span>
                                        )
                                    )}
                                </div>
                            </div>

                            {/* Away Roster */}
                            <div className="flex justify-between items-center group">
                                <span className="text-slate-400 w-12">Away:</span>
                                <div className="flex-1 text-right">
                                    {(p.roster.away && p.roster.away.length > 0) ? (
                                        <span>{p.roster.away.map(pl => pl.name).join(', ')}</span>
                                    ) : (
                                        state.isAdmin ? (
                                            <button
                                                onClick={() => setAssigning({ pid: p.id, team: 'away' })}
                                                className="text-xs bg-green-900 text-green-300 px-2 py-1 rounded hover:bg-green-800"
                                            >
                                                + Assign
                                            </button>
                                        ) : (
                                            <span className="text-slate-600 italic">Empty</span>
                                        )
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Assignment Modal */}
            {assigning && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
                    <div className="bg-slate-800 w-full max-w-md rounded-xl p-4 border border-slate-700 flex flex-col max-h-[80vh]">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-lg">Assign {assigning.team.toUpperCase()} Player</h3>
                            <button onClick={() => setAssigning(null)} className="text-3xl">&times;</button>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-2">
                            {(state.availablePlayers[assigning.team] || []).map(pl => (
                                <button
                                    key={pl.id}
                                    onClick={() => {
                                        adminAssignPlayer(assigning.pid, pl, assigning.team);
                                        setAssigning(null);
                                    }}
                                    className="w-full text-left p-3 bg-slate-900 hover:bg-slate-700 rounded border border-slate-800 flex justify-between"
                                >
                                    <span className="font-bold">{pl.name}</span>
                                    <span className="text-slate-400 text-xs">{pl.pos}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

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
