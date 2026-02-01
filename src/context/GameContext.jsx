import { createContext, useContext, useReducer, useEffect, useRef, useState } from 'react';
import {
    createRoomDb, getRoomByCode, addParticipantDb,
    subscribeToRoom, updateRoom, updateParticipant, getParticipantsByRoom
} from '../lib/supabaseClient';
import { getRoster } from '../lib/nfl';

const GameContext = createContext();

// --- Initial State ---
const initialState = {
    roomId: null,
    roomCode: null,
    phase: 'SETUP', // SETUP, DRAFT, LIVE, PAUSED
    draftPhase: 'HOME', // HOME, AWAY
    currentTurnIndex: 0,
    ante: 0,
    pot: 0,

    // Data
    teams: { home: '', away: '' },
    availablePlayers: { home: [], away: [] },
    participants: [], // Array of objects

    // My Identity (Persisted)
    myId: null,
    isAdmin: false, // Trust localStorage
};

// --- Reducer (DUMB State Replacer) ---
function gameReducer(state, action) {
    switch (action.type) {
        case 'SET_IDENTITY':
            return { ...state, myId: action.payload.id, isAdmin: action.payload.isAdmin };
        case 'JOIN_SUCCESS':
            return { ...state, roomId: action.payload.roomId, roomCode: action.payload.roomCode };
        case 'SYNC_ROOM':
            const r = action.payload;
            return {
                ...state,
                phase: r.phase,
                pot: r.pot,
                ante: r.ante,
                draftPhase: r.draft_phase || 'HOME', // Note: mapped from snake_case
                currentTurnIndex: r.current_turn_index,
                teams: r.teams || state.teams,
                availablePlayers: r.available_players || state.availablePlayers,
            };
        case 'SYNC_PARTICIPANTS':
            return { ...state, participants: action.payload };
        case 'RESET':
            return initialState;
        default:
            return state;
    }
}

export function GameProvider({ children }) {
    const [state, dispatch] = useReducer(gameReducer, initialState);
    const roomIdRef = useRef(null); // For immediate access in callbacks

    // --- Actions ---

    const saveSession = (code, id, isAdmin) => {
        localStorage.setItem(`football_session_${code}`, JSON.stringify({ id, isAdmin }));
        localStorage.setItem('football_last_room', code);
    };

    const createRoom = async (adminName, homeTeam, awayTeam) => {
        const code = generateCode();
        // Create Room
        const { data: room, error } = await createRoomDb(code);
        if (error) { console.error(error); return; }

        // Populate Players
        const homeRoster = getRoster(homeTeam);
        const awayRoster = getRoster(awayTeam);

        // Update basic room data + players
        await updateRoom(room.id, {
            teams: { home: homeTeam, away: awayTeam },
            available_players: { home: homeRoster, away: awayRoster },
            ante: 2 // Default Ante
        });

        // Add Admin Participant
        const { data: p, error: pError } = await addParticipantDb(room.id, adminName, true);
        if (pError) { console.error(pError); return; }

        // Save Identity
        saveSession(code, p.id, true);
        dispatch({ type: 'SET_IDENTITY', payload: { id: p.id, isAdmin: true } });
        dispatch({ type: 'JOIN_SUCCESS', payload: { roomId: room.id, roomCode: code } });
        roomIdRef.current = room.id;

        // Initial Participant Sync
        dispatch({ type: 'SYNC_PARTICIPANTS', payload: [p] });
    };

    const joinRoom = async (code, name) => {
        const { data: room, error } = await getRoomByCode(code);
        if (!room) { alert('Room not found'); return; }

        // Create Participant
        const { data: p, error: pError } = await addParticipantDb(room.id, name, false);
        if (pError) { console.error(pError); return; }

        // Save Identity
        saveSession(code, p.id, false);
        dispatch({ type: 'SET_IDENTITY', payload: { id: p.id, isAdmin: false } });
        dispatch({ type: 'JOIN_SUCCESS', payload: { roomId: room.id, roomCode: code } });
        roomIdRef.current = room.id;

        // Initial Fetch
        const { data: parts } = await getParticipantsByRoom(room.id);
        if (parts) dispatch({ type: 'SYNC_PARTICIPANTS', payload: parts });
    };

    const rejoin = async () => {
        const lastCode = localStorage.getItem('football_last_room');
        if (!lastCode) return;
        const session = JSON.parse(localStorage.getItem(`football_session_${lastCode}`));
        if (!session) return;

        const { data: room } = await getRoomByCode(lastCode);
        if (!room) return;

        // Verify participant still exists in DB?
        // For now, trust local storage for speed
        dispatch({ type: 'SET_IDENTITY', payload: { id: session.id, isAdmin: session.isAdmin } });
        dispatch({ type: 'JOIN_SUCCESS', payload: { roomId: room.id, roomCode: lastCode } });
        roomIdRef.current = room.id;

        // Initial Fetch
        const { data: parts } = await getParticipantsByRoom(room.id);
        if (parts) dispatch({ type: 'SYNC_PARTICIPANTS', payload: parts });
    };

    const startDraft = async () => {
        if (!state.isAdmin) return;
        // Deduct Ante from everyone? (Simplified: Just start draft)
        // Switch to DRAFT phase
        await updateRoom(state.roomId, { phase: 'DRAFT', current_turn_index: 0 });
    };

    const makePick = async (player, teamSide) => {
        // 1. Get current participant data
        const me = state.participants.find(p => p.id === state.myId);
        if (!me) return;

        // 2. Update Roster (Local Optimistic + DB)
        const newRoster = { ...me.roster, [teamSide]: [...(me.roster[teamSide] || []), player] };

        // Supabase maps column roster_home / roster_away
        let updatesPart = {};
        if (teamSide === 'home') updatesPart.roster_home = newRoster.home;
        if (teamSide === 'away') updatesPart.roster_away = newRoster.away;

        await updateParticipant(me.id, updatesPart);

        // 3. Update Room Available Players
        const newAvailable = {
            ...state.availablePlayers,
            [teamSide]: state.availablePlayers[teamSide].filter(p => p.id !== player.id)
        };

        let updatesRoom = { available_players: newAvailable };

        // 4. Global State Logic
        if (state.phase === 'DRAFT') {
            // Basic turn increment (visual only since we are loose with turns)
            updatesRoom.current_turn_index = state.currentTurnIndex + 1;

            // Check if draft complete?
            // If everyone has Home + Away? -> Go LIVE
            // We can do this check loosely.
            // Or just let Admin click "Start Game" manually?
            // Auto-start is better.
            // But syncing that check is hard.
            // Let's just stay in DRAFT until Admin clicks "Start Game" or manual trigger?
            // Or, if *I* am the last one...
            // Let's keep it simple: DRAFT phase stays until Admin clicks "Start Game".
        }

        // If CATCH-UP (LIVE), we check roster completeness in App.jsx.
        // We do NOT change phase here.

        await updateRoom(state.roomId, updatesRoom);
    };

    const startGame = async () => {
        if (!state.isAdmin) return;
        await updateRoom(state.roomId, { phase: 'LIVE' });
    };

    const handleTouchdown = async (teamSide) => {
        // 1. Find who has players on this team
        // Mock: just logging for now.
        // Implementation:
        // Identify scoring player? Or just Team TD?
        // User asked for "Touchdown Home/Away".
        // BUT logic requires *Player* to score.
        // If Team TD, who wins?
        // Maybe we just payout to *someone*?
        // Let's assume we need to pick a player.
        // For simplicity: pop up a modal in LiveDashboard?
        // Or simplified rule: Random winner? No.

        // Okay, standard rule: Admin selects Player who scored.
        // Since we don't have lists, Admin needs to see "Available Scorers" (Drafted Players on that team).
        // Let's worry about this UI later.
        // For now, simple "Reset Round" functionality.

        // Reset Logic:
        // Clear Rosters.
        // Reset Available Players (Return everyone).
        // Phase -> DRAFT.

        const originalHome = getRoster(state.teams.home);
        const originalAway = getRoster(state.teams.away);

        // Clear all rosters
        const clearPromises = state.participants.map(p =>
            updateParticipant(p.id, { roster_home: [], roster_away: [] })
        );
        await Promise.all(clearPromises);

        // Reset Room
        await updateRoom(state.roomId, {
            phase: 'DRAFT',
            available_players: { home: originalHome, away: originalAway },
            current_turn_index: 0
        });
    };

    // --- Subscription ---
    useEffect(() => {
        if (!state.roomId) {
            rejoin();
            return;
        }

        const unsub = subscribeToRoom(
            state.roomId,
            (room) => dispatch({ type: 'SYNC_ROOM', payload: room }),
            (parts) => dispatch({ type: 'SYNC_PARTICIPANTS', payload: parts }) // parts needs formatting?
            // DB returns roster_home / roster_away.
            // Component expects roster.home / roster.away.
            // Let's format inside the reducer or here?
            // Formatting here is safer.
        );
        return () => { if (unsub) unsub(); };
    }, [state.roomId]);

    // Format helper
    const formattedParticipants = state.participants.map(p => ({
        ...p,
        roster: { home: p.roster_home, away: p.roster_away },
        isAdmin: p.is_admin
    }));

    const value = {
        state: { ...state, participants: formattedParticipants }, // Expose formatted
        createRoom,
        joinRoom,
        makePick,
        startDraft,
        startGame,
        handleTouchdown,
        // ... (other actions like startDraft, recordTouchdown to be added)
    };

    return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export const useGame = () => useContext(GameContext);

// Import helper
function generateCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
}
