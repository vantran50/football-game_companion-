import { useState } from 'react';
import { useGame } from '../context/GameContext';
import { User, Shield, Loader2 } from 'lucide-react';

export default function JoinScreen() {
    const { setAdmin, joinRoom } = useGame();
    const [name, setName] = useState('');
    const [roomCode, setRoomCode] = useState('');
    const [isAdmin, setIsAdmin] = useState(false);
    const [isJoining, setIsJoining] = useState(false);
    const [error, setError] = useState(null);

    const handleStart = () => {
        if (isAdmin) {
            setAdmin(); // Sets isAdmin flag, routes to SetupScreen
        }
    };

    const handleJoin = async () => {
        if (!roomCode.trim()) {
            setError('Please enter a room code');
            return;
        }
        if (!name.trim()) {
            setError('Please enter your name');
            return;
        }

        setError(null);
        setIsJoining(true);

        const { success, error: joinError } = await joinRoom(roomCode.trim(), name.trim(), 0);

        setIsJoining(false);

        if (!success) {
            setError(joinError || 'Failed to join room');
        }
        // If success, state updates and routing happens automatically
    };

    return (
        <div className="max-w-md mx-auto mt-20 space-y-8">
            <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold">Welcome</h2>
                <p className="text-slate-400">Join a draft room or start a new one.</p>
            </div>

            <div className="bg-surface p-6 rounded-xl space-y-6 border border-slate-700">
                <div className="flex gap-4 p-1 bg-slate-900 rounded-lg">
                    <button
                        className={`flex-1 py-2 rounded-md transition ${!isAdmin ? 'bg-primary text-white' : 'text-slate-400'}`}
                        onClick={() => { setIsAdmin(false); setError(null); }}
                    >
                        I'm a Player
                    </button>
                    <button
                        className={`flex-1 py-2 rounded-md transition ${isAdmin ? 'bg-accent text-white' : 'text-slate-400'}`}
                        onClick={() => { setIsAdmin(true); setError(null); }}
                    >
                        I'm the Admin
                    </button>
                </div>

                {isAdmin ? (
                    <div className="space-y-4">
                        <div className="p-4 bg-slate-900/50 rounded border border-accent/20 text-accent text-sm">
                            <Shield className="inline w-4 h-4 mr-2" />
                            You will act as the Bank and TV Controller.
                        </div>
                        <button
                            onClick={handleStart}
                            className="w-full py-3 bg-accent hover:bg-amber-600 rounded-lg font-bold text-black"
                        >
                            Start Setup
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <input
                            placeholder="Room Code (e.g. A3BU)"
                            value={roomCode}
                            onChange={e => setRoomCode(e.target.value.toUpperCase())}
                            maxLength={4}
                            className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg focus:ring-2 focus:ring-primary outline-none text-center text-2xl tracking-widest font-mono uppercase"
                        />
                        <input
                            placeholder="Your Name"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                        />

                        {error && (
                            <p className="text-red-400 text-sm text-center">{error}</p>
                        )}

                        <button
                            onClick={handleJoin}
                            disabled={isJoining}
                            className="w-full py-3 bg-primary hover:bg-blue-600 disabled:bg-slate-700 rounded-lg font-bold flex items-center justify-center gap-2"
                        >
                            {isJoining ? (
                                <><Loader2 className="w-5 h-5 animate-spin" /> Joining...</>
                            ) : (
                                'Join Game'
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

