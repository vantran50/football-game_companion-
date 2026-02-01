import { useState } from 'react';
import { useGame } from '../context/GameContext';
import { cn } from '../lib/utils'; // Assuming utils exists

export default function JoinScreen() {
    const { createRoom, joinRoom } = useGame();
    const [mode, setMode] = useState('join'); // join | create
    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [homeTeam, setHomeTeam] = useState('DET');
    const [awayTeam, setAwayTeam] = useState('GB');

    const handleCreate = () => {
        if (!name) return alert('Enter name');
        createRoom(name, homeTeam, awayTeam);
    };

    const handleJoin = () => {
        if (!name || !code) return alert('Enter name and code');
        joinRoom(code.toUpperCase(), name);
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 space-y-6">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">
                Football Draft
            </h1>

            <div className="w-full max-w-sm bg-slate-800 p-6 rounded-xl border border-slate-700">
                <div className="flex mb-6 bg-slate-900 rounded-lg p-1">
                    <button
                        onClick={() => setMode('join')}
                        className={cn("flex-1 py-2 rounded-md transition", mode === 'join' ? "bg-blue-600 shadow" : "text-slate-400")}
                    >Join</button>
                    <button
                        onClick={() => setMode('create')}
                        className={cn("flex-1 py-2 rounded-md transition", mode === 'create' ? "bg-green-600 shadow" : "text-slate-400")}
                    >Create</button>
                </div>

                <div className="space-y-4">
                    <input
                        className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg focus:border-blue-500 outline-none"
                        placeholder="Your Name"
                        value={name} onChange={e => setName(e.target.value)}
                    />

                    {mode === 'join' ? (
                        <>
                            <input
                                className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg font-mono tracking-widest uppercase"
                                placeholder="ROOM CODE"
                                maxLength={4}
                                value={code} onChange={e => setCode(e.target.value)}
                            />
                            <button onClick={handleJoin} className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold shadow-lg shadow-blue-900/20">
                                JOIN GAME
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-xs text-slate-400">Home</label>
                                    <input value={homeTeam} onChange={e => setHomeTeam(e.target.value)} className="w-full p-2 bg-slate-900 rounded border border-slate-700" />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400">Away</label>
                                    <input value={awayTeam} onChange={e => setAwayTeam(e.target.value)} className="w-full p-2 bg-slate-900 rounded border border-slate-700" />
                                </div>
                            </div>
                            <button onClick={handleCreate} className="w-full py-4 bg-green-600 hover:bg-green-500 rounded-lg font-bold shadow-lg shadow-green-900/20">
                                CREATE ROOM
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
