import { createContext, useContext, useReducer, useEffect, useRef, useState } from 'react';
import {
    createRoomDb, getRoomByCode, addParticipantDb,
    subscribeToRoom, updateRoom, updateParticipant, getParticipantsByRoom
} from '../lib/supabaseClient';

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
        const code = generateCode(); // You need to import this or move it here. Assume imported.
        // Create Room
        const { data: room, error } = await createRoomDb(code);
        if (error) { console.error(error); return; }

        // Update basic room data
        await updateRoom(room.id, { teams: { home: homeTeam, away: awayTeam } });

        // Add Admin Participant
        const { data: p, error: pError } = await addParticipantDb(room.id, adminName, true);
        if (pError) { console.error(pError); return; }

        // Save Identity
        saveSession(code, p.id, true);
        dispatch({ type: 'SET_IDENTITY', payload: { id: p.id, isAdmin: true } });
        dispatch({ type: 'JOIN_SUCCESS', payload: { roomId: room.id, roomCode: code } });
        roomIdRef.current = room.id;
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

    const makePick = async (player, teamSide) => {
        // 1. Get current participant data
        const me = state.participants.find(p => p.id === state.myId);
        if (!me) return;

        // 2. Update Roster
        const newRoster = { ...me.roster, [teamSide]: [...(me.roster[teamSide] || []), player] };
        await updateParticipant(me.id, {
            roster_home: newRoster.home,
            roster_away: newRoster.away
        }); // Note: Mapping logic handled in SupabaseClient or here? 
        // SupabaseClient expects separate columns.
        // updateParticipant({ roster_home: ..., roster_away: ... })
        // Let's ensure updateParticipant can handle partials.

        // 3. Update Available Players (Remove picked)
        const newAvailable = {
            ...state.availablePlayers,
            [teamSide]: state.availablePlayers[teamSide].filter(p => p.id !== player.id)
        };

        // 4. Global State Logic (ONLY if DRAFT phase)
        let updates = { available_players: newAvailable }; // columns must match DB snake_case

        if (state.phase === 'DRAFT') {
            // Normal Draft Flow
            updates.current_turn_index = state.currentTurnIndex + 1;
            // TODO: Add turn logic here or keep it simple?
            // User asked for "Simple".
            // Creating a "Re-roll" button for Admin is easier than complex auto-turn logic.
            // But let's add basic increment.
        }

        await updateRoom(state.roomId, updates);
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
