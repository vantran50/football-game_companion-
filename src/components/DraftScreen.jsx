import { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { Clock } from 'lucide-react';
import { cn } from '../lib/utils';

export default function DraftScreen() {
    const { state, makePick } = useGame();

    // Timer Mock (Local state for visual, ideally synced)
    const [seconds, setSeconds] = useState(120);

    // Position Filter State
    const [filterPos, setFilterPos] = useState('ALL');
    const positions = ['ALL', 'QB', 'RB', 'WR', 'TE', 'DST'];

    useEffect(() => {
        setSeconds(120);
        const interval = setInterval(() => {
            setSeconds(s => Math.max(0, s - 1));
        }, 1000);
        return () => clearInterval(interval);
    }, [state.currentTurnIndex]); // Reset on turn change

    const currentDrafter = state.participants.find(p => p.id === state.draftOrder[state.currentTurnIndex]);
    const activeTeamSide = state.draftPhase === 'HOME' ? 'home' : 'away';
    const activeTeam = state.draftPhase === 'HOME' ? state.teams.home : state.teams.away;

    // CRITICAL: Only show players from the ACTIVE team's pool
    // Players are removed from availablePlayers when drafted (in reducer)
    const activePool = state.availablePlayers[activeTeamSide] || [];

    // Filter by position
    const displayPool = activePool.filter(p =>
        filterPos === 'ALL' ? true : p.pos === filterPos
    );

    const isMyTurn = currentDrafter && (currentDrafter.id === state.myParticipantId || state.isAdmin);

    const handleSelect = (player) => {
        if (!currentDrafter) return;
        if (!isMyTurn) return; // Prevent picking out of turn

        const confirmed = window.confirm(`Draft ${player.name} (${player.pos}) for ${currentDrafter.name}?`);
        if (!confirmed) return;

        makePick(currentDrafter.id, player, activeTeamSide);
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Draft Status Header */}
            <div className="bg-surface p-6 rounded-xl border border-slate-700 text-center space-y-4">
                <div className="flex justify-center items-center gap-2 text-slate-400 uppercase tracking-widest text-xs font-bold">
                    Drafting Round: <span className={cn(
                        "px-2 py-0.5 rounded ml-1",
                        state.draftPhase === 'HOME' ? "bg-sky-900/50 text-sky-400" : "bg-emerald-900/50 text-emerald-400"
                    )}>{state.draftPhase} ({activeTeam?.name})</span>
                </div>

                <div className="space-y-1">
                    <h2 className="text-4xl font-bold text-white">
                        {currentDrafter ? currentDrafter.name : 'Completed'}
                    </h2>
                    <p className={cn("text-lg font-bold", isMyTurn ? "text-emerald-400 animate-pulse" : "text-slate-400")}>
                        {isMyTurn ? "IT'S YOUR TURN!" : "is on the clock"}
                    </p>
                </div>

                <div className="flex justify-center items-center gap-2 text-2xl font-mono text-accent">
                    <Clock className="w-6 h-6" />
                    {Math.floor(seconds / 60)}:{(seconds % 60).toString().padStart(2, '0')}
                </div>
            </div>

            {/* Draft Board */}
            <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <h3 className="text-lg font-bold text-slate-300">
                        Available Players: <span className={cn(
                            "font-bold",
                            state.draftPhase === 'HOME' ? "text-sky-400" : "text-emerald-400"
                        )}>{activeTeam?.name}</span>
                        <span className="text-slate-500 ml-2">({activePool.length} remaining)</span>
                    </h3>

                    {/* Position Filter */}
                    <div className="flex gap-1 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
                        {positions.map(pos => (
                            <button
                                key={pos}
                                onClick={() => setFilterPos(pos)}
                                className={cn(
                                    "px-3 py-1 rounded-full text-xs font-bold transition whitespace-nowrap",
                                    filterPos === pos
                                        ? "bg-primary text-white"
                                        : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                                )}
                            >
                                {pos}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Player List - SINGLE TEAM ONLY */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                    {displayPool.length === 0 && (
                        <div className="col-span-full text-center py-10 text-slate-500 italic">
                            {filterPos === 'ALL'
                                ? 'No players remaining in this pool.'
                                : `No ${filterPos} players available.`}
                        </div>
                    )}
                    {displayPool.map(player => (
                        <button
                            key={player.id}
                            onClick={() => handleSelect(player)}
                            className={cn(
                                "flex items-center justify-between p-4 border rounded-lg transition group text-left",
                                state.draftPhase === 'HOME'
                                    ? "bg-sky-900/20 border-sky-800/50 hover:border-sky-500 hover:bg-sky-900/40"
                                    : "bg-emerald-900/20 border-emerald-800/50 hover:border-emerald-500 hover:bg-emerald-900/40",
                                !isMyTurn && "opacity-50 cursor-not-allowed hover:bg-transparent hover:border-slate-800"
                            )}
                        >
                            <div>
                                <div className="font-bold text-lg">{player.name}</div>
                                <div className="text-slate-400 text-sm flex gap-2">
                                    <span className="font-mono text-slate-500">#{player.num}</span>
                                    <span className="bg-slate-800 px-1 rounded text-xs text-slate-300">{player.pos}</span>
                                </div>
                            </div>
                            <div className={cn(
                                "opacity-0 group-hover:opacity-100 font-bold",
                                state.draftPhase === 'HOME' ? "text-sky-400" : "text-emerald-400",
                                !isMyTurn && "hidden"
                            )}>
                                Select
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
