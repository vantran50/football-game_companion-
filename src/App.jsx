import { GameProvider, useGame } from './context/GameContext';
import SetupScreen from './components/SetupScreen';
import DraftScreen from './components/DraftScreen';
import LiveDashboard from './components/LiveDashboard';
import JoinScreen from './components/JoinScreen'; // Need to create

function GameRouter() {
    const { state } = useGame();

    // 1. Not in a room? -> Join/Create
    if (!state.roomCode) {
        return <JoinScreen />;
    }

    // 2. Catch-up Logic (View Layer Enforcer)
    // If LIVE but I have empty slots, force Draft.
    if (state.phase === 'LIVE' && state.myId) {
        const me = state.participants.find(p => p.id === state.myId);
        if (me) {
            // Note: formattedParticipants in Context creates me.roster.home/away
            const hasHome = me.roster.home && me.roster.home.length > 0;
            const hasAway = me.roster.away && me.roster.away.length > 0;
            if (!hasHome || !hasAway) {
                return (
                    <div className="h-screen flex flex-col">
                        <div className="bg-yellow-600 p-2 text-center text-sm font-bold animate-pulse">
                            ⚠️ CATCH-UP DRAFT: SELECT YOUR TEAM
                        </div>
                        <DraftScreen isCatchUp={true} />
                    </div>
                );
            }
        }
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
