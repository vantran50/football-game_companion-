import { createContext, useContext, useReducer, useEffect, useRef, useState } from 'react';
import {
    createRoomDb, getRoomByCode, addParticipantDb,
    subscribeToRoom, updateRoom, updateParticipant, getParticipantsByRoom
} from '../lib/supabaseClient';
import { getRoster } from '../lib/nfl';

const GameContext = createContext();

const getInitialState = () => {
    const base = {
        roomId: null,
        roomCode: null,
        phase: 'SETUP',
        draftPhase: 'HOME',
        currentTurnIndex: 0,
        ante: 0,
        pot: 0,
        teams: { home: '', away: '' },
        availablePlayers: { home: [], away: [] },
        participants: [],
        myId: null,
        isAdmin: false
    };

    // Synchronous Restore
    try {
        const lastCode = sessionStorage.getItem('football_last_room');
        if (lastCode) {
            const session = JSON.parse(sessionStorage.getItem(`football_session_${lastCode}`));
            if (session) {
                return {
                    ...base,
                    myId: session.id,
                    isAdmin: session.isAdmin,
                    roomCode: lastCode // Restore code immediately
                };
            }
        }
    } catch (e) { console.error('Storage init error', e); }

    return base;
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
            return { ...state, participants: action.payload }; // Payload is RAW from DB
        case 'OPTIMISTIC_PICK':
            // Payload: { playerId, teamSide, myId }
            const { playerId, teamSide, myId } = action.payload;

            // 1. Remove from Available
            const newAvail = {
                ...state.availablePlayers,
                [teamSide]: state.availablePlayers[teamSide].filter(p => p.id !== playerId)
            };

            // 2. Add to My Roster (in participants)
            // Note: We are modifying the RAW participants array
            const newParts = state.participants.map(p => {
                if (p.id !== myId) return p;

                // Construct new raw roster
                const currentRaw = (teamSide === 'home') ? (p.roster_home || []) : (p.roster_away || []);
                const newRaw = [...currentRaw, state.availablePlayers[teamSide].find(pl => pl.id === playerId)];

                return {
                    ...p,
                    [teamSide === 'home' ? 'roster_home' : 'roster_away']: newRaw
                };
            });

            return {
                ...state,
                availablePlayers: newAvail,
                participants: newParts
            };

        case 'RESET':
            return getInitialState();
        default:
            return state;
    }
}

export function GameProvider({ children }) {
    const [state, dispatch] = useReducer(gameReducer, undefined, getInitialState);
    const roomIdRef = useRef(null);

    // --- Actions ---

    // Format helper (Running on every render to ensure safety)
    const formattedParticipants = (state.participants || []).map(p => ({
        ...p,
        // SAFE ACCESS: Handle nulls/undefined from DB
        roster: {
            home: Array.isArray(p.roster_home) ? p.roster_home : [],
            away: Array.isArray(p.roster_away) ? p.roster_away : []
        },
        isAdmin: !!p.is_admin
    }));

    const saveSession = (code, id, isAdmin) => {
        sessionStorage.setItem(`football_session_${code}`, JSON.stringify({ id, isAdmin }));
        sessionStorage.setItem('football_last_room', code);
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

        // Save Identity (ADMIN HOST ONLY - No Participant Row yet)
        // User can join later if they want to play.
        saveSession(code, 'HOST', true);
        dispatch({ type: 'SET_IDENTITY', payload: { id: 'HOST', isAdmin: true } });
        dispatch({ type: 'JOIN_SUCCESS', payload: { roomId: room.id, roomCode: code } });
        roomIdRef.current = room.id;

        // Initial Participant Sync (Empty)
        dispatch({ type: 'SYNC_PARTICIPANTS', payload: [] });
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
        if (parts) {
            console.log('✅ Initial Join Participants Fetch:', parts);
            dispatch({ type: 'SYNC_PARTICIPANTS', payload: parts });
        }

        // Initial Room Data Sync (CRITICAL FIX)
        dispatch({ type: 'SYNC_ROOM', payload: room });
    };

    const rejoin = async () => {
        const lastCode = sessionStorage.getItem('football_last_room');
        if (!lastCode) return;
        const session = JSON.parse(sessionStorage.getItem(`football_session_${lastCode}`));
        if (!session) return;

        console.log('🔄 Rejoining Session:', session);

        const { data: room } = await getRoomByCode(lastCode);
        if (!room) return;

        // Verify participant still exists in DB?
        // For now, trust local storage for speed
        dispatch({ type: 'SET_IDENTITY', payload: { id: session.id, isAdmin: session.isAdmin } });
        dispatch({ type: 'JOIN_SUCCESS', payload: { roomId: room.id, roomCode: lastCode } });
        roomIdRef.current = room.id;

        // Initial Fetch
        const { data: parts } = await getParticipantsByRoom(room.id);
        if (parts) {
            console.log('🔄 Rejoin Participants Fetch:', parts.length);
            dispatch({ type: 'SYNC_PARTICIPANTS', payload: parts });
        } else {
            console.error('⚠️ Rejoin fetched 0 participants or failed.');
        }

        // Initial Room Data Sync (CRITICAL FIX)
        dispatch({ type: 'SYNC_ROOM', payload: room });
    };

    const startDraft = async () => {
        if (!state.isAdmin) return;
        // Deduct Ante from everyone? (Simplified: Just start draft)
        // Switch to DRAFT phase
        await updateRoom(state.roomId, { phase: 'DRAFT', current_turn_index: 0 });
    };

    const makePick = async (player, teamSide) => {
        // 1. Validation (Prevent Stale Picks)
        const isAvailable = state.availablePlayers[teamSide]?.some(p => p.id === player.id);
        if (!isAvailable) {
            alert("Player is no longer available.");
            return false;
        }

        const me = state.participants.find(p => p.id === state.myId);
        if (!me) return false;

        // 0. OPTIMISTIC UPDATE
        dispatch({ type: 'OPTIMISTIC_PICK', payload: { playerId: player.id, teamSide, myId: state.myId } });

        // 1. DB Updates
        const newRoster = { ...me.roster, [teamSide]: [...(me.roster[teamSide] || []), player] };
        let updatesPart = {};
        if (teamSide === 'home') updatesPart.roster_home = newRoster.home;
        if (teamSide === 'away') updatesPart.roster_away = newRoster.away;

        try {
            const { error: partError } = await updateParticipant(me.id, updatesPart);
            if (partError) throw partError;

            // Fetch latest room data (Race Protection)
            const { data: latestRoom } = await getRoomByCode(state.roomCode);

            let sourceAvailable = state.availablePlayers;
            let currentTurn = state.currentTurnIndex;

            if (latestRoom) {
                sourceAvailable = latestRoom.available_players;
                currentTurn = latestRoom.current_turn_index;
            }

            const newAvailable = {
                ...sourceAvailable,
                [teamSide]: (sourceAvailable[teamSide] || []).filter(p => p.id !== player.id)
            };

            const updatesRoom = { available_players: newAvailable, current_turn_index: currentTurn + 1 };

            const { error: roomError } = await updateRoom(state.roomId, updatesRoom);
            if (roomError) throw roomError;

            return true; // Success
        } catch (e) {
            alert("Draft Failed: " + e.message + "\n(Hint: Run the fix_permissions.sql script in Supabase)");
            console.error(e);
            return false;
        }
    };

    const startGame = async () => {
        if (!state.isAdmin) return;
        await updateRoom(state.roomId, { phase: 'LIVE' });
    };

    const handleTouchdown = async (teamSide) => {
        const originalHome = getRoster(state.teams.home);
        const originalAway = getRoster(state.teams.away);

        const clearPromises = state.participants.map(p =>
            updateParticipant(p.id, { roster_home: [], roster_away: [] })
        );
        await Promise.all(clearPromises);

        await updateRoom(state.roomId, {
            phase: 'DRAFT',
            available_players: { home: originalHome, away: originalAway },
            current_turn_index: 0
        });
    };

    const adminAssignPlayer = async (targetId, player, teamSide) => {
        if (!state.isAdmin) return;
        const target = state.participants.find(p => p.id === targetId);
        if (!target) return;

        // Update Roster
        const newRoster = { ...target.roster, [teamSide]: [...(target.roster[teamSide] || []), player] };
        let updatesPart = {};
        if (teamSide === 'home') updatesPart.roster_home = newRoster.home;
        if (teamSide === 'away') updatesPart.roster_away = newRoster.away;
        await updateParticipant(targetId, updatesPart);

        // Update Room (Remove from pool)
        const newAvailable = {
            ...state.availablePlayers,
            [teamSide]: state.availablePlayers[teamSide].filter(p => p.id !== player.id)
        };
        await updateRoom(state.roomId, { available_players: newAvailable });
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
