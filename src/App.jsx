import { GameProvider, useGame } from './context/GameContext';
import SetupScreen from './components/SetupScreen';
import DraftScreen from './components/DraftScreen';
import LiveDashboard from './components/LiveDashboard';
import JoinScreen from './components/JoinScreen'; // Need to create

function GameRouter() {
    const { state, rejoin } = useGame();

    // 1. Not in a room? -> Join/Create
    // 1. Initial Identity Recovery (Tab-Specific)
    useEffect(() => {
        // Nuke legacy storage to prevent conflicts (Fixes "Gaslighting" bugs)
        try { localStorage.clear(); } catch (e) { }

        rejoin();
    }, []);

    // 2. Not in a room? -> Join/Create
    if (!state.roomCode) {
        return <JoinScreen />;
    }

    // 2.5 Explicit Connection States
    // PREVENT FLASH OF WRONG SCREEN: Wait for Sync
    if (state.connectionStatus === 'REJOINING' || (state.roomCode && !state.roomId && state.connectionStatus !== 'ERROR')) {
        return (
            <div className="flex flex-col items-center justify-center h-screen space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                <div className="text-xl">Reconnecting to Game...</div>
                <div className="text-xs text-slate-500">Code: {state.roomCode}</div>
                <button
                    onClick={() => window.location.reload()}
                    className="text-sm text-slate-400 hover:text-white underline"
                >
                    Stuck? Refresh
                </button>
            </div>
        );
    }

    // 2.6 Error State (Session Lost)
    if (state.connectionStatus === 'ERROR') {
        return (
            <div className="flex flex-col items-center justify-center h-screen space-y-4 p-8 text-center">
                <div className="text-red-500 text-6xl">⚠️</div>
                <h2 className="text-2xl font-bold">Session Recovery Failed</h2>
                <p className="text-slate-400">Could not reconnect to room {state.roomCode}.</p>
                <div className="bg-slate-800 p-2 rounded text-red-400 text-sm mono">
                    {state.lastError || "Unknown Error"}
                </div>
                <button
                    onClick={() => {
                        sessionStorage.removeItem('football_last_room');
                        window.location.reload();
                    }}
                    className="bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-lg font-bold"
                >
                    Return to Home
                </button>
            </div>
        );
    }

    // 3. Global Phase Routing
    if (state.phase === 'SETUP') return <SetupScreen />;
    if (state.phase === 'DRAFT') return <DraftScreen />;
    if (state.phase === 'LIVE') return <LiveDashboard />;

    return <div>Loading...</div>;
}

export default function App() {
    return (
        <GameProvider>
            <div className="min-h-screen bg-slate-900 text-white">
                <GameRouter />
            </div>
        </GameProvider>
    );
}
