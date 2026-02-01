import { useState } from 'react';
import { GameProvider, useGame } from './context/GameContext';
import SetupScreen from './components/SetupScreen';
import DraftScreen from './components/DraftScreen';
import LiveDashboard from './components/LiveDashboard';
import JoinScreen from './components/JoinScreen';
import { LogOut } from 'lucide-react';

function GameRouter() {
  const { state } = useGame();

  // Route based on isAdmin flag instead of roomCode
  if (!state.isAdmin && !state.roomCode) {
    return <JoinScreen />;
  }

  // ROBUST LATE JOINER ROUTE:
  // If phase is LIVE/PAUSED but I have an incomplete roster, forced DRAFT SCREEN.
  // This physically prevents the "infinite loop" UI because once roster is full, we unmount.
  if ((state.phase === 'LIVE' || state.phase === 'PAUSED') && state.myParticipantId) {
    const me = state.participants.find(p => p.id === state.myParticipantId);
    if (me) {
      const hasHome = me.roster.home.length > 0;
      const hasAway = me.roster.away.length > 0;
      if (!hasHome || !hasAway) {
        return <DraftScreen />;
      }
    }
  }

  // Phase Router
  switch (state.phase) {
    case 'SETUP':
    case 'PAUSED':
    case 'REVIEW':
      return <SetupScreen />;
    case 'ANTE':
    case 'DRAFT':
      return <DraftScreen />;
    case 'LIVE':
      return <LiveDashboard />;
    default:
      return <div className="p-10 text-center">Unknown State</div>;
  }
}

function AppHeader() {
  const { state, leaveRoom } = useGame();

  return (
    <header className="p-4 border-b border-surface flex justify-between items-center">
      <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
        🏈 Draft Companion
      </h1>
      {state.roomCode && (
        <div className="flex items-center gap-4">
          <div className="px-3 py-1 bg-surface-light rounded-lg border border-slate-700 select-all">
            <span className="text-xs text-slate-400 mr-2">CODE:</span>
            <span className="font-mono font-bold tracking-wider">{state.roomCode}</span>
          </div>
          <button
            onClick={leaveRoom}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-red-900/50 border border-slate-700 hover:border-red-500 rounded-lg text-sm text-slate-400 hover:text-red-400 transition"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Leave</span>
          </button>
        </div>
      )}
    </header>
  );
}

function App() {
  return (
    <GameProvider>
      <div className="min-h-screen bg-background text-white font-sans">
        <AppHeader />
        <main className="container mx-auto p-4">
          <GameRouter />
        </main>
      </div>
    </GameProvider>
  );
}

export default App;
