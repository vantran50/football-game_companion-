import { useState, useMemo, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { Plus, Trash2, DollarSign, Play, Pencil, UserPlus, X, Check, Users, Loader2 } from 'lucide-react';
import { cn, generateCode } from '../lib/utils';
import { fetchGames, fetchGameRosters, fetchRoster, NFL_TEAMS } from '../lib/espn';

// ESPN API replaces mock data - games fetched on mount

export default function SetupScreen() {
    const {
        state,
        dispatch,
        addParticipant,
        startDraft,
        removeParticipant,
        startNextRound,
        updateAnte,
        updatePlayerBalance,
        updateParticipantName,
        startGame,
        createRoom,
        removePlayerFromPool,
        addPlayerToPool
    } = useGame();

    // Derive UI Phase from State (prevents reset on re-render)
    const uiPhase = useMemo(() => {
        if (state.phase === 'PAUSED') return 'room_setup'; // Intermission
        if (state.phase === 'REVIEW') return 'room_setup'; // Post-Draft Review (now stays on room setup, start game button)
        if (state.roomCode) return 'room_setup'; // Room created, show participant setup
        if (state.gameId) return 'review_pool'; // Game selected, show pool review
        return 'select_game'; // Default
    }, [state.phase, state.roomCode, state.gameId]);

    const [newPlayer, setNewPlayer] = useState('');
    const [buyIn, setBuyIn] = useState(0);
    const [editingId, setEditingId] = useState(null);
    const [editBalance, setEditBalance] = useState(0);
    const [editingNameId, setEditingNameId] = useState(null);
    const [editName, setEditName] = useState('');

    // Manual Pool Add State
    const [manualPlayerName, setManualPlayerName] = useState('');
    const [manualAddTeam, setManualAddTeam] = useState(null); // 'home' | 'away'

    // ESPN API State
    const [games, setGames] = useState([]);
    const [gamesLoading, setGamesLoading] = useState(true);
    const [gamesError, setGamesError] = useState(null);
    const [rosterLoading, setRosterLoading] = useState(false);

    const [selectedGameId, setSelectedGameId] = useState(null);

    // Custom Game State
    const [isCustomMode, setIsCustomMode] = useState(false);
    const [customHomeTeamId, setCustomHomeTeamId] = useState(NFL_TEAMS[0]?.id || '');
    const [customAwayTeamId, setCustomAwayTeamId] = useState(NFL_TEAMS[1]?.id || '');

    // Fetch games on mount
    useEffect(() => {
        let mounted = true;
        setGamesLoading(true);
        setGamesError(null);

        fetchGames()
            .then(fetchedGames => {
                if (!mounted) return;
                setGames(fetchedGames);
                if (fetchedGames.length > 0) {
                    setSelectedGameId(fetchedGames[0].id);
                }
            })
            .catch(err => {
                if (!mounted) return;
                setGamesError(err.message || 'Failed to fetch games');
            })
            .finally(() => {
                if (mounted) setGamesLoading(false);
            });

        return () => { mounted = false; };
    }, []);

    const handleAdd = () => {
        if (!newPlayer) return;
        addParticipant(newPlayer, buyIn);
        setNewPlayer('');
    };

    const isPausing = state.phase === 'PAUSED';
    const isReview = state.phase === 'REVIEW';

    const handleEditStart = (p) => {
        setEditingId(p.id);
        setEditBalance(p.balance);
    };

    const handleEditSave = (id) => {
        updatePlayerBalance(id, parseInt(editBalance));
        setEditingId(null);
    };

    const handleNameEditStart = (p) => {
        setEditingNameId(p.id);
        setEditName(p.name);
    };

    const handleNameEditSave = (id) => {
        if (editName.trim()) {
            updateParticipantName(id, editName.trim());
        }
        setEditingNameId(null);
    };

    const handleConfirmGame = async () => {
        if (isCustomMode) {
            const homeTeam = NFL_TEAMS.find(t => t.id === customHomeTeamId);
            const awayTeam = NFL_TEAMS.find(t => t.id === customAwayTeamId);

            if (!homeTeam || !awayTeam) return;

            setRosterLoading(true);
            try {
                const [homeRoster, awayRoster] = await Promise.all([
                    fetchRoster(homeTeam.id, homeTeam.abbrev),
                    fetchRoster(awayTeam.id, awayTeam.abbrev)
                ]);

                // Team color mapping
                const TEAM_COLORS = {
                    ARI: '#97233F', ATL: '#A71930', BAL: '#241773', BUF: '#00338D',
                    CAR: '#0085CA', CHI: '#0B162A', CIN: '#FB4F14', CLE: '#311D00',
                    DAL: '#003594', DEN: '#FB4F14', DET: '#0076B6', GB: '#203731',
                    HOU: '#03202F', IND: '#002C5F', JAX: '#006778', KC: '#E31837',
                    LAC: '#0080C6', LAR: '#003594', LV: '#000000', MIA: '#008E97',
                    MIN: '#4F2683', NE: '#002244', NO: '#D3BC8D', NYG: '#0B2265',
                    NYJ: '#125740', PHI: '#004C54', PIT: '#FFB612', SEA: '#002244',
                    SF: '#AA0000', TB: '#D50A0A', TEN: '#0C2340', WAS: '#5A1414'
                };

                dispatch({
                    type: 'SET_GAME_DATA',
                    payload: {
                        teams: {
                            home: { id: homeTeam.id, name: homeTeam.name, color: TEAM_COLORS[homeTeam.abbrev] || '#333', abbrev: homeTeam.abbrev },
                            away: { id: awayTeam.id, name: awayTeam.name, color: TEAM_COLORS[awayTeam.abbrev] || '#333', abbrev: awayTeam.abbrev }
                        },
                        roster: { home: homeRoster, away: awayRoster },
                        gameId: 'CUSTOM_' + Date.now()
                    }
                });
            } catch (err) {
                setGamesError(err.message || 'Failed to fetch rosters');
            } finally {
                setRosterLoading(false);
            }
            return;
        }

        const game = games.find(g => g.id === selectedGameId);
        if (!game) return;

        setRosterLoading(true);
        try {
            const roster = await fetchGameRosters(game);
            dispatch({
                type: 'SET_GAME_DATA',
                payload: {
                    teams: { home: game.home, away: game.away },
                    roster: roster,
                    gameId: selectedGameId
                }
            });
        } catch (err) {
            setGamesError(err.message || 'Failed to fetch rosters');
        } finally {
            setRosterLoading(false);
        }
    };

    const handleConfirmPoolAndCreateRoom = () => {
        createRoom();
    };

    const executeManualPoolAdd = () => {
        if (!manualPlayerName || !manualAddTeam) return;
        addPlayerToPool(manualPlayerName, manualAddTeam);
        setManualPlayerName('');
        setManualAddTeam(null);
    };

    // --- UI Phase: Game Selection ---
    if (uiPhase === 'select_game') {
        const selectedGame = games.find(g => g.id === selectedGameId);

        // Loading state
        if (gamesLoading) {
            return (
                <div className="max-w-2xl mx-auto space-y-8 pt-10">
                    <div className="text-center">
                        <h2 className="text-3xl font-bold">Select Game</h2>
                        <p className="text-slate-400 mt-2">Loading games from ESPN...</p>
                    </div>
                    <div className="flex justify-center py-12">
                        <Loader2 className="w-12 h-12 animate-spin text-primary" />
                    </div>
                </div>
            );
        }

        // Error state
        if (gamesError) {
            return (
                <div className="max-w-2xl mx-auto space-y-8 pt-10">
                    <div className="text-center">
                        <h2 className="text-3xl font-bold text-red-500">Error Loading Games</h2>
                        <p className="text-slate-400 mt-2">{gamesError}</p>
                    </div>
                    <button
                        onClick={() => window.location.reload()}
                        className="mx-auto block py-3 px-6 bg-primary hover:bg-blue-600 rounded-lg font-bold transition"
                    >
                        Retry
                    </button>
                </div>
            );
        }

        // No games available
        if (games.length === 0) {
            return (
                <div className="max-w-2xl mx-auto space-y-8 pt-10">
                    <div className="text-center">
                        <h2 className="text-3xl font-bold">No Games Today</h2>
                        <p className="text-slate-400 mt-2">There are no NFL games scheduled right now. Check back later!</p>
                    </div>
                </div>
            );
        }

        return (
            <div className="max-w-2xl mx-auto space-y-8 pt-10">
                <div className="text-center">
                    <h2 className="text-3xl font-bold">Select Game</h2>
                    <p className="text-slate-400 mt-2">Choose the football game to import rosters from.</p>
                </div>

                <div className="bg-surface p-6 rounded-xl border border-slate-700 space-y-6">

                    {/* Toggle Custom Mode */}
                    <div className="flex justify-end">
                        <button
                            onClick={() => setIsCustomMode(!isCustomMode)}
                            className="text-xs text-primary hover:text-blue-400 underline"
                        >
                            {isCustomMode ? "Switch to Live Games" : "Switch to Custom Game"}
                        </button>
                    </div>

                    {isCustomMode ? (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs text-slate-400">Home Team</label>
                                    <select
                                        value={customHomeTeamId}
                                        onChange={e => setCustomHomeTeamId(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-lg font-bold outline-none focus:ring-2 focus:ring-primary"
                                    >
                                        {NFL_TEAMS.map(team => (
                                            <option key={team.id} value={team.id}>
                                                {team.abbrev} - {team.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs text-slate-400">Away Team</label>
                                    <select
                                        value={customAwayTeamId}
                                        onChange={e => setCustomAwayTeamId(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-lg font-bold outline-none focus:ring-2 focus:ring-primary"
                                    >
                                        {NFL_TEAMS.map(team => (
                                            <option key={team.id} value={team.id}>
                                                {team.abbrev} - {team.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <p className="text-xs text-slate-500 text-center">Rosters will be imported from ESPN when you confirm.</p>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-2">
                                <label className="text-sm text-slate-400">Available Games ({games.length})</label>
                                <select
                                    value={selectedGameId || ''}
                                    onChange={e => setSelectedGameId(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-lg font-bold text-primary outline-none focus:ring-2 focus:ring-primary"
                                >
                                    {games.map(g => (
                                        <option key={g.id} value={g.id} className="bg-slate-900 text-white">
                                            {g.label} {g.status !== 'Scheduled' ? `(${g.status})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {selectedGame && (
                                <div className="flex justify-center gap-8 py-4">
                                    <div className="text-center">
                                        <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center text-xl font-bold" style={{ backgroundColor: selectedGame.home.color }}>
                                            {selectedGame.home.abbrev}
                                        </div>
                                        <span className="text-sm text-slate-400 mt-2 block">{selectedGame.home.name}</span>
                                    </div>
                                    <div className="text-3xl text-slate-600 self-center">vs</div>
                                    <div className="text-center">
                                        <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center text-xl font-bold" style={{ backgroundColor: selectedGame.away.color }}>
                                            {selectedGame.away.abbrev}
                                        </div>
                                        <span className="text-sm text-slate-400 mt-2 block">{selectedGame.away.name}</span>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    <button
                        onClick={handleConfirmGame}
                        disabled={rosterLoading || (!isCustomMode && !selectedGameId)}
                        className="w-full py-3 bg-primary hover:bg-blue-600 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg font-bold text-lg transition flex items-center justify-center gap-2"
                    >
                        {rosterLoading ? (
                            <><Loader2 className="w-5 h-5 animate-spin" /> Loading Rosters...</>
                        ) : (
                            <><Check className="w-5 h-5" /> {isCustomMode ? "Create Custom Game" : "Import Rosters & Review"}</>
                        )}
                    </button>
                </div>
            </div>
        );
    }

    // --- UI Phase: Player Pool Review ---
    if (uiPhase === 'review_pool') {
        return (
            <div className="max-w-6xl mx-auto space-y-8">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-3xl font-bold text-secondary">Player Pool Review</h2>
                        <p className="text-slate-400">Review and edit the draftable players for each team.</p>
                    </div>
                    <button
                        onClick={handleConfirmPoolAndCreateRoom}
                        className="bg-primary hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2"
                    >
                        <Users className="w-5 h-5" /> Confirm & Create Room
                    </button>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                    {/* Home Team Pool */}
                    <div className="bg-surface rounded-xl border border-slate-700 overflow-hidden">
                        <div className="p-4 bg-sky-900/20 border-b border-white/10 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-sky-400">Home: {state.teams.home.name} ({state.availablePlayers.home.length})</h3>
                            <button
                                onClick={() => setManualAddTeam('home')}
                                className="text-xs bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded flex items-center gap-1"
                            >
                                <Plus className="w-3 h-3" /> Add Player
                            </button>
                        </div>
                        <div className="p-4 space-y-1 max-h-[400px] overflow-y-auto">
                            {state.availablePlayers.home.length === 0 && <span className="text-xs text-slate-600 italic">No players in pool</span>}
                            {state.availablePlayers.home.map(pl => (
                                <div key={pl.id} className="flex justify-between items-center bg-slate-900/50 p-2 rounded text-sm group">
                                    <span>{pl.name} <span className="text-slate-500 text-xs">({pl.pos})</span></span>
                                    <button
                                        onClick={() => removePlayerFromPool(pl, 'home')}
                                        className="text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Away Team Pool */}
                    <div className="bg-surface rounded-xl border border-slate-700 overflow-hidden">
                        <div className="p-4 bg-emerald-900/20 border-b border-white/10 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-emerald-400">Away: {state.teams.away.name} ({state.availablePlayers.away.length})</h3>
                            <button
                                onClick={() => setManualAddTeam('away')}
                                className="text-xs bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded flex items-center gap-1"
                            >
                                <Plus className="w-3 h-3" /> Add Player
                            </button>
                        </div>
                        <div className="p-4 space-y-1 max-h-[400px] overflow-y-auto">
                            {state.availablePlayers.away.length === 0 && <span className="text-xs text-slate-600 italic">No players in pool</span>}
                            {state.availablePlayers.away.map(pl => (
                                <div key={pl.id} className="flex justify-between items-center bg-slate-900/50 p-2 rounded text-sm group">
                                    <span>{pl.name} <span className="text-slate-500 text-xs">({pl.pos})</span></span>
                                    <button
                                        onClick={() => removePlayerFromPool(pl, 'away')}
                                        className="text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Manual Add Dialog Overlay */}
                {manualAddTeam && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                        <div className="bg-surface p-6 rounded-xl border border-slate-700 w-96 space-y-4">
                            <h3 className="font-bold text-lg">Add Player to {manualAddTeam === 'home' ? 'Home' : 'Away'} Pool</h3>

                            <div className="space-y-2">
                                <label className="text-xs text-slate-400">Player Name</label>
                                <input
                                    value={manualPlayerName}
                                    onChange={e => setManualPlayerName(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                                    placeholder="e.g. Calvin Johnson"
                                    autoFocus
                                    onKeyDown={e => e.key === 'Enter' && executeManualPoolAdd()}
                                />
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={() => setManualAddTeam(null)}
                                    className="flex-1 py-2 bg-slate-700 rounded hover:bg-slate-600"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={executeManualPoolAdd}
                                    disabled={!manualPlayerName}
                                    className="flex-1 py-2 bg-primary rounded hover:bg-blue-600 disabled:opacity-50 font-bold"
                                >
                                    Add Player
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // --- UI Phase: Room Setup (Room Created, Add Participants, Start Draft) ---
    // Also handles PAUSED state for intermission and REVIEW for post-draft

    // NON-ADMIN VIEW: Waiting Screen
    if (!state.isAdmin) {
        // Find this participant's balance
        const myParticipant = state.participants.find(p => p.id === state.myParticipantId);
        const myBalance = myParticipant?.balance ?? 0;

        // Check if there's a recent winner (within last 60 seconds)
        const lastWinner = state.lastWinner;
        const isRecentWin = lastWinner && (Date.now() - lastWinner.timestamp < 60000);
        const iAmTheWinner = lastWinner && myParticipant && lastWinner.participantId === myParticipant.id;

        return (
            <div className="max-w-xl mx-auto space-y-8 pt-20 text-center">
                {/* Winner Notification Banner */}
                {isRecentWin && (
                    <div className={`p-6 rounded-2xl border-2 ${iAmTheWinner
                            ? 'bg-gradient-to-r from-emerald-900/80 to-green-900/80 border-emerald-500'
                            : 'bg-gradient-to-r from-slate-900 to-slate-800 border-slate-600'
                        } animate-in slide-in-from-top duration-300`}>
                        <div className="text-center">
                            <div className={`text-3xl font-bold mb-2 ${iAmTheWinner ? 'text-emerald-300' : 'text-slate-200'
                                }`}>
                                {iAmTheWinner
                                    ? '🎉 Congratulations! You won!'
                                    : `Better luck next time! Winner: ${lastWinner.participantName}`}
                            </div>
                            <div className="text-slate-400">
                                <span>Touchdown: {lastWinner.playerName}</span>
                                {lastWinner.potWon > 0 && (
                                    <span className="ml-2 text-emerald-400 font-bold">Pot: ${lastWinner.potWon}</span>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <div className="bg-surface p-8 rounded-2xl border border-slate-700 shadow-2xl space-y-6">
                    <Loader2 className="w-16 h-16 text-primary animate-spin mx-auto" />

                    <div>
                        <h2 className="text-3xl font-bold">Waiting for Host...</h2>
                        <p className="text-slate-400 mt-2">
                            {isPausing ? 'The commissioner is setting up the next round.' : 'The game will start shortly.'}
                        </p>
                    </div>

                    <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-700/50">
                        <div className="bg-slate-900/50 p-4 rounded-xl">
                            <div className="text-xs text-slate-500 uppercase font-bold">Pot</div>
                            <div className="text-2xl font-mono text-emerald-400">${state.pot}</div>
                        </div>
                        <div className="bg-slate-900/50 p-4 rounded-xl">
                            <div className="text-xs text-slate-500 uppercase font-bold">Ante</div>
                            <div className="text-2xl font-mono text-slate-300">${state.ante}</div>
                        </div>
                        <div className="bg-slate-900/50 p-4 rounded-xl">
                            <div className="text-xs text-slate-500 uppercase font-bold">Your Tokens</div>
                            <div className={cn("text-2xl font-mono", myBalance < 0 ? "text-red-400" : "text-emerald-400")}>${myBalance}</div>
                        </div>
                    </div>

                    {state.roomCode && (
                        <div className="inline-block px-4 py-2 bg-slate-800 rounded-full text-sm font-mono text-slate-400">
                            Room: <span className="text-white font-bold">{state.roomCode}</span>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold">
                        {isPausing ? 'Round Intermission' : isReview ? 'Draft Complete' : 'Room Setup'}
                    </h2>
                    <p className="text-slate-400">
                        {isPausing ? 'Modify ledger or remove players before next round.' : isReview ? 'Review rosters before going live.' : 'Add participants and configure the ledger.'}
                    </p>
                </div>
                {state.roomCode && (
                    <div className="bg-surface px-6 py-3 rounded-lg border border-primary text-center">
                        <span className="text-slate-400 text-xs block">Room Code</span>
                        <span className="text-2xl font-mono font-bold text-primary tracking-widest">{state.roomCode}</span>
                    </div>
                )}
            </div>

            {/* Post-Draft Review: Show Start Live Game button */}
            {isReview && (
                <div className="bg-emerald-900/20 border border-emerald-700 p-6 rounded-xl text-center">
                    <p className="text-lg mb-4">All players drafted! Ready to start the game?</p>
                    <button
                        onClick={startGame}
                        className="bg-red-600 hover:bg-red-700 px-8 py-3 rounded-lg font-bold text-lg animate-pulse flex items-center gap-2 mx-auto"
                    >
                        <Play className="w-5 h-5" /> START LIVE GAME
                    </button>
                </div>
            )}

            <div className="grid md:grid-cols-2 gap-8">
                {/* Helper Panel */}
                <div className="space-y-6">
                    {/* Ante Configuration */}
                    <div className="bg-surface p-6 rounded-xl border border-slate-700 space-y-4">
                        <h3 className="font-bold border-b border-slate-700 pb-2">Game Settings</h3>
                        <div className="space-y-2">
                            <label className="text-sm text-slate-400">Ante Amount (Per Round)</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                                <input
                                    type="number"
                                    value={state.ante}
                                    onChange={e => updateAnte(parseInt(e.target.value))}
                                    className="w-full pl-9 p-2 bg-slate-900 border border-slate-700 rounded focus:ring-2 focus:ring-primary outline-none"
                                />
                            </div>
                            <p className="text-xs text-slate-500">Deducted automatically at start of every round.</p>
                        </div>
                    </div>

                    {!isReview && (
                        <div className="bg-surface p-6 rounded-xl border border-slate-700 space-y-4">
                            <h3 className="font-bold border-b border-slate-700 pb-2">Add Participant</h3>
                            <div className="space-y-2">
                                <label className="text-sm text-slate-400">Player Name</label>
                                <input
                                    value={newPlayer}
                                    onChange={e => setNewPlayer(e.target.value)}
                                    className="w-full p-2 bg-slate-900 border border-slate-700 rounded focus:ring-2 focus:ring-primary outline-none"
                                    placeholder="e.g. Mike"
                                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm text-slate-400">Buy-In Amount (Tokens)</label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                                    <input
                                        type="number"
                                        value={buyIn}
                                        onChange={e => setBuyIn(parseInt(e.target.value))}
                                        className="w-full pl-9 p-2 bg-slate-900 border border-slate-700 rounded focus:ring-2 focus:ring-primary outline-none"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleAdd}
                                className="w-full py-2 bg-primary hover:bg-blue-600 rounded font-bold flex items-center justify-center gap-2"
                            >
                                <UserPlus className="w-4 h-4" /> Add to Ledger
                            </button>
                        </div>
                    )}
                </div>

                {/* Roster & Start */}
                <div className="space-y-6">
                    <div className="bg-surface p-6 rounded-xl border border-slate-700 min-h-[300px] flex flex-col">
                        <h3 className="font-bold border-b border-slate-700 pb-2 mb-4">Ledger ({state.participants.length})</h3>

                        <div className="flex-1 space-y-2 max-h-[400px] overflow-y-auto">
                            {state.participants.length === 0 && (
                                <div className="text-slate-500 text-center italic py-10">No participants yet.</div>
                            )}
                            {state.participants.map(p => (
                                <div key={p.id} className="flex justify-between items-center bg-slate-900 p-3 rounded group relative">
                                    {/* Editable Name */}
                                    {editingNameId === p.id ? (
                                        <input
                                            type="text"
                                            value={editName}
                                            onChange={e => setEditName(e.target.value)}
                                            className="flex-1 max-w-[120px] p-1 text-sm bg-black border border-slate-600 rounded"
                                            autoFocus
                                            onBlur={() => handleNameEditSave(p.id)}
                                            onKeyDown={e => e.key === 'Enter' && handleNameEditSave(p.id)}
                                        />
                                    ) : (
                                        <div className="flex items-center gap-2 group/name cursor-pointer" onClick={() => handleNameEditStart(p)}>
                                            <span className="font-medium">{p.name}</span>
                                            <Pencil className="w-3 h-3 text-slate-600 opacity-0 group-hover/name:opacity-100" />
                                        </div>
                                    )}
                                    <div className="flex items-center gap-4">
                                        {editingId === p.id ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    value={editBalance}
                                                    onChange={e => setEditBalance(e.target.value)}
                                                    className="w-20 p-1 text-sm bg-black border border-slate-600 rounded text-right"
                                                    autoFocus
                                                    onBlur={() => handleEditSave(p.id)}
                                                    onKeyDown={e => e.key === 'Enter' && handleEditSave(p.id)}
                                                />
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 group/balance cursor-pointer" onClick={() => handleEditStart(p)}>
                                                <span className={cn("font-mono", p.balance < 0 ? "text-red-400" : "text-emerald-400")}>
                                                    ${p.balance}
                                                </span>
                                                <Pencil className="w-3 h-3 text-slate-600 opacity-0 group-hover/balance:opacity-100" />
                                            </div>
                                        )}

                                        {/* Remove Button */}
                                        <button
                                            onClick={() => removeParticipant(p.id)}
                                            className="text-slate-600 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
                                            title="Remove Participant"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {!isReview && (
                            <div className="pt-6 mt-6 border-t border-slate-700">
                                {isPausing ? (
                                    <>
                                        <button
                                            onClick={startNextRound}
                                            disabled={!state.participants.every(p => p.balance >= state.ante)}
                                            className="w-full py-3 bg-secondary hover:bg-emerald-600 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg font-bold text-lg transition flex items-center justify-center gap-2"
                                        >
                                            <Play className="w-5 h-5" /> Start Next Round
                                        </button>
                                        {!state.participants.every(p => p.balance >= state.ante) && (
                                            <p className="text-xs text-center text-red-400 mt-2">
                                                ⚠️ Some participants don't have enough tokens for ante (${state.ante})
                                            </p>
                                        )}
                                    </>
                                ) : (
                                    <button
                                        onClick={startDraft}
                                        disabled={state.participants.length < 2}
                                        className="w-full py-3 bg-secondary hover:bg-emerald-600 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg font-bold text-lg transition"
                                    >
                                        Start Draft
                                    </button>
                                )}
                                <p className="text-xs text-center text-slate-500 mt-2">
                                    {isPausing
                                        ? `Starts next round. Deducts $${state.ante} from everyone.`
                                        : `Deducts Ante ($${state.ante}) from everyone automatically.`}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
