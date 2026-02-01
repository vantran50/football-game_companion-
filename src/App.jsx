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
