import { createContext, useContext, useEffect, useState, useRef } from 'react';
import {
    createRoomDb, getRoomByCode, addParticipantDb,
    updateRoom, updateParticipant, getParticipantsByRoom
} from '../lib/supabaseClient';
import { getRoster } from '../lib/nfl';

const GameContext = createContext();

// SESSION KEYS
const SESS_KEY_LAST = 'football_last_room';
const getSessionKey = (code) => `football_session_${code}`;

export function GameProvider({ children }) {
    // --- GLOBAL STATE ---
    const [room, setRoom] = useState(null);
    const [participants, setParticipants] = useState([]);
    const [identity, setIdentity] = useState({ id: null, isAdmin: false });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Derived State
    const myId = identity.id;
    const isAdmin = identity.isAdmin;

    // --- CORE SYNC ENGINE ---
    const sync = async () => {
        // 1. Get Room Code from Session
        const code = localStorage.getItem(SESS_KEY_LAST);
        if (!code) {
            setLoading(false);
            return;
        }

        // 2. Load Identity from Session (TRUST LOCAL STORAGE)
        try {
            const stored = JSON.parse(localStorage.getItem(getSessionKey(code)));
            if (stored && (stored.id !== identity.id || stored.isAdmin !== identity.isAdmin)) {
                setIdentity(stored); // Update local identity match
            }
        } catch (e) { }

        // 3. Fetch Data (Server Authoritative)
        const { data: serverRoom, error: rErr } = await getRoomByCode(code);
        if (rErr || !serverRoom) {
            // Room might be gone or error
            // Don't nuke session immediately to avoid flickering, but stop loading
            setLoading(false);
            return;
        }

        const { data: serverParts, error: pErr } = await getParticipantsByRoom(serverRoom.id);

        // 4. Update State
        setRoom(serverRoom);
        if (serverParts) setParticipants(serverParts);
        setLoading(false);
    };

    // --- POLLING LOOP ---
    useEffect(() => {
        // Initial load
        sync();

        // Loop (1 second - Aggressive Sync)
        const interval = setInterval(sync, 1000);
        return () => clearInterval(interval);
    }, []);

    // --- ACTIONS ---

    const createRoom = async (name, homeTeam, awayTeam) => {
        const code = generateCode();
        // DB Setup
        const { data: newRoom, error } = await createRoomDb(code);
        if (error) {
            console.error("Create Room Error:", error);
            alert("Error creating room: " + (error.message || JSON.stringify(error)));
            return;
        }

        await updateRoom(newRoom.id, {
            teams: { home: homeTeam, away: awayTeam },
            available_players: { home: getRoster(homeTeam), away: getRoster(awayTeam) },
            ante: 2
        });

        // Session Setup (ADMIN)
        const sess = { id: 'HOST', isAdmin: true };
        localStorage.setItem(SESS_KEY_LAST, code);
        localStorage.setItem(getSessionKey(code), JSON.stringify(sess));

        // Instant Sync
        setIdentity(sess);
        await sync();
    };

    const joinRoom = async (code, name) => {
        // 1. Check Room
        const { data: r } = await getRoomByCode(code);
        if (!r) { alert("Room not found"); return; }

        // 2. Create Participant
        const { data: p } = await addParticipantDb(r.id, name, false);
        if (!p) return;

        // 3. Session Setup (PLAYER)
        // CHECK: Was I already Admin? (Host joining as player)
        let newIsAdmin = false;
        try {
            const oldSess = JSON.parse(localStorage.getItem(getSessionKey(code)));
            if (oldSess && oldSess.isAdmin) newIsAdmin = true;
        } catch (e) { }

        const sess = { id: p.id, isAdmin: newIsAdmin };
        localStorage.setItem(SESS_KEY_LAST, code);
        localStorage.setItem(getSessionKey(code), JSON.stringify(sess));

        // Instant Sync
        setIdentity(sess);
        await sync();
    };

    // DRAFTING
    const makePick = async (player, teamSide) => {
        // Pessimistic Check
        if (!room) return false;

        // 1. Validations
        const currentPool = room.available_players[teamSide] || [];
        if (!currentPool.find(p => p.id === player.id)) {
            alert("Player taken!");
            await sync();
            return false;
        }

        // 2. DB Update (Participant)
        const me = participants.find(p => p.id === myId);
        if (!me) return false;

        const currentRoster = (teamSide === 'home' ? me.roster_home : me.roster_away) || [];
        const newRoster = [...currentRoster, player];

        await updateParticipant(me.id, {
            [teamSide === 'home' ? 'roster_home' : 'roster_away']: newRoster
        });

        // 3. DB Update (Room)
        const newPool = currentPool.filter(p => p.id !== player.id);
        const { error } = await updateRoom(room.id, {
            available_players: { ...room.available_players, [teamSide]: newPool },
            current_turn_index: room.current_turn_index + 1
        });

        if (error) {
            alert("Draft Error");
            return false;
        }

        // 4. Force Sync
        await sync();
        return true;
    };

    const adminAssignPlayer = async (targetId, player, teamSide) => {
        if (!isAdmin || !room) return;

        const target = participants.find(p => p.id === targetId);
        if (!target) return;

        // Add to Target
        const currentRoster = (teamSide === 'home' ? target.roster_home : target.roster_away) || [];
        await updateParticipant(targetId, {
            [teamSide === 'home' ? 'roster_home' : 'roster_away']: [...currentRoster, player]
        });

        // Remove from Pool
        const currentPool = room.available_players[teamSide] || [];
        const newPool = currentPool.filter(p => p.id !== player.id);
        await updateRoom(room.id, {
            available_players: { ...room.available_players, [teamSide]: newPool }
        });

        await sync();
    };

    const startDraft = async () => {
        if (!isAdmin || !room) return;
        await updateRoom(room.id, { phase: 'DRAFT', current_turn_index: 0 });
        await sync();
    };

    const startGame = async () => {
        if (!isAdmin || !room) return;
        await updateRoom(room.id, { phase: 'LIVE' });
        await sync();
    };

    const handleTouchdown = async (teamSide) => {
        if (!isAdmin || !room) return;
        // Reset Everyone
        const originalHome = getRoster(room.teams.home);
        const originalAway = getRoster(room.teams.away);

        const promises = participants.map(p =>
            updateParticipant(p.id, { roster_home: [], roster_away: [] })
        );
        await Promise.all(promises);

        await updateRoom(room.id, {
            phase: 'DRAFT',
            available_players: { home: originalHome, away: originalAway },
            current_turn_index: 0
        });
        await sync();
    };

    // Emergency Fix Action
    const forceAdmin = () => {
        if (!room) return;
        const code = room.code;
        const newSess = { id: myId, isAdmin: true };
        localStorage.setItem(getSessionKey(code), JSON.stringify(newSess));
        setIdentity(newSess);
    };

    // --- FORMATTING ---
    const formattedParticipants = participants.map(p => ({
        ...p,
        roster: {
            home: p.roster_home || [],
            away: p.roster_away || []
        },
        isAdmin: !!p.is_admin
    }));

    // --- EXPORT ---
    const value = {
        state: {
            roomCode: room?.code,
            roomId: room?.id,
            phase: room?.phase || 'SETUP',
            participants: formattedParticipants,
            myId: myId,
            isAdmin: isAdmin,
            availablePlayers: room?.available_players || { home: [], away: [] },
            teams: room?.teams || { home: '', away: '' },
            loading: loading
        },
        createRoom,
        joinRoom,
        makePick,
        startDraft,
        startGame,
        handleTouchdown,
        adminAssignPlayer,
        forceAdmin
    };

    return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export const useGame = () => useContext(GameContext);

function generateCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
}
