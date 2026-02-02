import { GameProvider, useGame } from './context/GameContext';
import SetupScreen from './components/SetupScreen';
import DraftScreen from './components/DraftScreen';
import LiveDashboard from './components/LiveDashboard';
import JoinScreen from './components/JoinScreen'; // Need to create

function GameRouter() {
    const { state } = useGame();

    // 1. Initial Identity Recovery (Handled by Context Sync)
    useEffect(() => {
        // Nuke legacy storage to prevent conflicts
        try { localStorage.clear(); } catch (e) { }
    }, []);

    // 2. Loading State
    if (state.loading) {
        return (
            <div className="flex flex-col items-center justify-center h-screen space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                <div className="text-xl">Connecting...</div>
            </div>
        );
    }

    // 3. Not in a room? -> Join/Create
    if (!state.roomCode) {
        return <JoinScreen />;
    }

    // 4. Global Phase Routing
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
