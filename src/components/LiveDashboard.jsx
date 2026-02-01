import { useState } from 'react';
import { useGame } from '../context/GameContext';
import { Trophy, Coins, Flame } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function LiveDashboard() {
    const { state, handleScore } = useGame();

    // Scoring Modal State
    const [scoringTeam, setScoringTeam] = useState(null); // 'home' | 'away'

    const triggerConfetti = () => {
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
        });
    };

    const onConfirmScore = (playerId) => {
        handleScore(playerId, scoringTeam);
        triggerConfetti();
        setScoringTeam(null);
    };

    // Get list of drafted players for the active scoring team to show in dropdown
    const draftedPlayers = scoringTeam
        ? state.participants.flatMap(p => p.roster[scoringTeam].map(pl => ({ ...pl, ownerName: p.name })))
        : [];

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            {/* HUD */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Pot */}
                <div className="md:col-span-1 bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-2xl border border-slate-700 flex flex-col items-center justify-center text-center shadow-2xl shadow-black/50">
                    <h3 className="text-slate-400 uppercase tracking-widest text-xs font-bold mb-2">Current Pot</h3>
                    <div className="text-6xl font-black text-emerald-400 font-mono flex items-top">
                        <span className="text-2xl mt-2">$</span>
                        {state.pot}
                    </div>
                </div>

                {/* Score Controls (Admin Only) */}
                {state.isAdmin && (
                    <div className="md:col-span-2 grid grid-cols-2 gap-4">
                        <button
                            onClick={() => setScoringTeam('home')}
                            className="group relative overflow-hidden bg-blue-900/40 hover:bg-blue-800 border-2 border-blue-500/30 hover:border-blue-400 rounded-2xl p-6 transition flex flex-col items-center justify-center"
                        >
                            <div className="absolute inset-0 bg-blue-500/10 group-hover:bg-blue-500/20 transition" />
                            <Flame className="w-10 h-10 text-blue-400 mb-2" />
                            <span className="text-2xl font-bold text-blue-100">TOUCHDOWN HOME</span>
                        </button>

                        <button
                            onClick={() => setScoringTeam('away')}
                            className="group relative overflow-hidden bg-amber-900/40 hover:bg-amber-800 border-2 border-amber-500/30 hover:border-amber-400 rounded-2xl p-6 transition flex flex-col items-center justify-center"
                        >
                            <div className="absolute inset-0 bg-amber-500/10 group-hover:bg-amber-500/20 transition" />
                            <Flame className="w-10 h-10 text-amber-400 mb-2" />
                            <span className="text-2xl font-bold text-amber-100">TOUCHDOWN AWAY</span>
                        </button>
                    </div>
                )}

                {!state.isAdmin && (
                    <div className="md:col-span-2 bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-2xl border border-slate-700 flex flex-col items-center justify-center text-center shadow-2xl">
                        <h3 className="text-slate-400 uppercase tracking-widest text-xs font-bold mb-2">Status</h3>
                        <div className="text-xl text-slate-300 animate-pulse">
                            Waiting for Touchdown...
                        </div>
                    </div>
                )}
            </div>

            {/* Roster Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {state.participants.map(p => (
                    <div key={p.id} className="bg-surface rounded-xl border border-slate-700 overflow-hidden relative">
                        <div className="bg-slate-900 p-3 flex justify-between items-center border-b border-slate-700">
                            <span className="font-bold">{p.name}</span>
                            <div className="flex items-center gap-2">
                                {p.winnings > 0 && (
                                    <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                                        <Trophy className="w-3 h-3" /> {p.winnings}
                                    </span>
                                )}
                                <span className="text-emerald-400 font-mono text-sm">${p.balance}</span>
                            </div>
                        </div>

                        <div className="p-3 space-y-2">
                            {/* Home Slots */}
                            <div className="text-xs text-slate-500 uppercase font-bold">Lions (Home)</div>
                            {p.roster.home.length === 0 ? (
                                <div className="text-sm text-slate-600 italic">Empty</div>
                            ) : (
                                p.roster.home.map(pl => (
                                    <div key={pl.id} className="text-sm bg-slate-800 p-2 rounded border border-slate-700/50">
                                        {pl.name} <span className="text-slate-500 text-xs">({pl.pos})</span>
                                    </div>
                                ))
                            )}

                            {/* Away Slots */}
                            <div className="text-xs text-slate-500 uppercase font-bold mt-2">Packers (Away)</div>
                            {p.roster.away.length === 0 ? (
                                <div className="text-sm text-slate-600 italic">Empty</div>
                            ) : (
                                p.roster.away.map(pl => (
                                    <div key={pl.id} className="text-sm bg-slate-800 p-2 rounded border border-slate-700/50">
                                        {pl.name} <span className="text-slate-500 text-xs">({pl.pos})</span>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Active Turn Indicator (if relevant, though we are in LIVE mode mostly) */}
                    </div>
                ))}
            </div>

            {/* Scoring Modal Overlay */}
            {scoringTeam && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-surface w-full max-w-md rounded-2xl border border-slate-600 p-6 space-y-6 animate-in zoom-in-95 duration-200">
                        <div className="text-center">
                            <h2 className="text-2xl font-bold mb-2">Who Scored?</h2>
                            <p className="text-slate-400">Select the player to award the pot.</p>
                        </div>

                        <div className="grid grid-cols-1 gap-2 max-h-[60vh] overflow-y-auto">
                            {draftedPlayers.length === 0 ? (
                                <div className="text-center text-slate-500 py-10">No players drafted for this team!</div>
                            ) : (
                                draftedPlayers.map(pl => (
                                    <button
                                        key={pl.id}
                                        onClick={() => onConfirmScore(pl.id)}
                                        className="flex justify-between items-center p-4 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl transition group"
                                    >
                                        <div>
                                            <div className="font-bold">{pl.name}</div>
                                            <div className="text-xs text-slate-500">{pl.pos} • #{pl.num}</div>
                                        </div>
                                        <div className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-300">
                                            Owned by {pl.ownerName}
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>

                        <button
                            onClick={() => setScoringTeam(null)}
                            className="w-full py-3 text-slate-400 hover:text-white"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
