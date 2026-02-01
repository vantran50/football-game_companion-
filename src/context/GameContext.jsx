import { createContext, useContext, useReducer, useEffect, useRef, useCallback } from 'react';
import { generateCode } from '../lib/utils';
import {
    supabase,
    isLive,
    createRoom as createRoomDb,
    addParticipant as addParticipantDb,
    updateRoom,
    updateParticipant,
    getParticipantsByRoom,
    subscribeToRoom,
    getRoomByCode
} from '../lib/supabaseClient';

const GameContext = createContext();

const initialState = {
    roomId: null,
    roomCode: null,
    isAdmin: false,
    phase: 'SETUP', // SETUP, ANTE, DRAFT, LIVE

    // Data
    gameId: null, // ESPN Game ID
    teams: {
        home: { id: 'DET', name: 'Lions', color: '#0076B6' },
        away: { id: 'GB', name: 'Packers', color: '#203731' }
    }, // { id, name, color }

    // Participants & Ledger
    participants: [], // { id, name, balance, winnings, roster: { home: [], away: [] } }
    pot: 0,
    ante: 2,

    // Draft State
    draftOrder: [], // Array of Participant IDs
    currentTurnIndex: 0,
    draftPhase: 'HOME', // HOME, AWAY
    draftExpiresAt: null,

    // Roster Data (Fetched)
    availablePlayers: { home: [], away: [] },
    originalRoster: { home: [], away: [] }, // Store original for reset after TD

    // Multiplayer
    myParticipantId: null, // Set when joining as a non-admin player

    // Last Winner (for notifications)
    lastWinner: null, // { participantId, participantName, playerName, potWon, timestamp }
};

function gameReducer(state, action) {
    switch (action.type) {
        case 'CREATE_ROOM':
            return { ...state, roomCode: action.payload, isAdmin: true };
        case 'SET_ROOM_ID':
            return { ...state, roomId: action.payload };
        case 'SET_ADMIN':
            return { ...state, isAdmin: true };
        case 'JOIN_ROOM':
            return {
                ...state,
                roomCode: action.payload.code,
                roomId: action.payload.roomId,
                phase: action.payload.phase || state.phase,
                pot: action.payload.pot ?? state.pot,
                ante: action.payload.ante ?? state.ante,
                draftPhase: action.payload.draftPhase || state.draftPhase,
                currentTurnIndex: action.payload.currentTurnIndex ?? state.currentTurnIndex,
                draftOrder: action.payload.draftOrder || state.draftOrder,
                teams: action.payload.teams || state.teams,
                availablePlayers: action.payload.availablePlayers || state.availablePlayers,
                originalRoster: action.payload.originalRoster || state.originalRoster,
                participants: action.payload.participants || [],
                myParticipantId: action.payload.myParticipantId
            };
        case 'SET_GAME_DATA':
            return {
                ...state,
                teams: action.payload.teams,
                availablePlayers: action.payload.roster,
                originalRoster: action.payload.roster, // Store original for TD reset
                gameId: action.payload.gameId
            };

        // Ledger Actions
        case 'ADD_PARTICIPANT':
            // CRITICAL: Default balance 0 as requested ("zero ledger")
            // If payload has balance (e.g. from existing logic), use it, otherwise 0.
            const newParticipant = { ...action.payload, balance: action.payload.balance !== undefined ? action.payload.balance : 0 };
            return { ...state, participants: [...state.participants, newParticipant] };

        case 'UPDATE_BALANCE':
            return {
                ...state,
                participants: state.participants.map(p =>
                    p.id === action.payload.id ? { ...p, balance: action.payload.balance } : p
                )
            };
        case 'COLLECT_ANTE':
            const totalCollected = state.participants.length * state.ante;
            return {
                ...state,
                participants: state.participants.map(p => ({ ...p, balance: p.balance - state.ante })),
                pot: state.pot + totalCollected,
                phase: 'DRAFT',
                draftPhase: 'HOME', // Always start with Home (or Team A)
                currentTurnIndex: 0,
                draftOrder: state.participants.map(p => p.id)
            };

        // Draft Actions
        case 'MAKE_PICK':
            // payload: { participantId, player, teamSide }
            const updatedParticipants = state.participants.map(p =>
                p.id === action.payload.participantId
                    ? { ...p, roster: { ...p.roster, [action.payload.teamSide]: [...p.roster[action.payload.teamSide], action.payload.player] } }
                    : p
            );

            // LIVE PHASE: Free Agent Pickup (No turn logic)
            if (state.phase === 'LIVE') {
                return {
                    ...state,
                    participants: updatedParticipants,
                    availablePlayers: {
                        ...state.availablePlayers,
                        [action.payload.teamSide]: state.availablePlayers[action.payload.teamSide].filter(pl => pl.id !== action.payload.player.id)
                    }
                };
            }

            // Phase Transition Logic MOVED INSIDE REDUCER
            const nextTurnIndex = state.currentTurnIndex + 1;
            // CRITICAL: Use draftOrder.length, not participants.length (for catch-up drafts)
            const isRoundComplete = nextTurnIndex >= state.draftOrder.length;

            if (isRoundComplete) {
                // NEW: Check for pending catch-up AFTER scoring team redraft
                if (state.pendingCatchUp) {
                    return {
                        ...state,
                        participants: updatedParticipants,
                        availablePlayers: {
                            ...state.availablePlayers,
                            [action.payload.teamSide]: state.availablePlayers[action.payload.teamSide].filter(pl => pl.id !== action.payload.player.id)
                        },
                        // Transition to catch-up phase for non-scoring team
                        draftPhase: state.pendingCatchUp.teamSide.toUpperCase(),
                        draftOrder: state.pendingCatchUp.participantIds,
                        currentTurnIndex: 0,
                        pendingCatchUp: null // Clear it
                    };
                }

                // LEGACY: Support for old nextDraftPhase pattern (Catch-Up Complete)
                if (state.nextDraftPhase) {
                    return {
                        ...state,
                        participants: updatedParticipants,
                        availablePlayers: {
                            ...state.availablePlayers,
                            [action.payload.teamSide]: state.availablePlayers[action.payload.teamSide].filter(pl => pl.id !== action.payload.player.id)
                        },
                        draftPhase: state.nextDraftPhase,
                        draftOrder: state.nextDraftOrder,
                        currentTurnIndex: 0,
                        nextDraftPhase: null,
                        nextDraftOrder: null
                    };
                }

                // Normal Round Complete Logic
                if (state.draftPhase === 'HOME') {
                    // Check if this was "Initial Draft" or "Redraft"?
                    // Initial Draft Flow: Home -> Away -> Review -> Live
                    // Redraft Flow: Single Phase -> Live (usually)

                    // If Home is done, and Away is empty, it's Initial Round 1.
                    const isInitialHome = state.participants.every(p => p.roster.away.length === 0);

                    if (isInitialHome) {
                        // Go to Away
                        return {
                            ...state,
                            participants: updatedParticipants,
                            availablePlayers: {
                                ...state.availablePlayers,
                                [action.payload.teamSide]: state.availablePlayers[action.payload.teamSide].filter(pl => pl.id !== action.payload.player.id)
                            },
                            draftPhase: 'AWAY',
                            currentTurnIndex: 0,
                            draftOrder: [...state.draftOrder].reverse() // Snake
                        };
                    } else {
                        // Redraft for Home (someone scored, we just drafted replacement).
                        // Go to Live? Or Review? Let's go Live for speed.
                        return {
                            ...state,
                            participants: updatedParticipants,
                            availablePlayers: {
                                ...state.availablePlayers,
                                [action.payload.teamSide]: state.availablePlayers[action.payload.teamSide].filter(pl => pl.id !== action.payload.player.id)
                            },
                            phase: 'LIVE',
                            currentTurnIndex: 0
                        };
                    }
                } else {
                    // draftPhase === 'AWAY'
                    // Check if this is initial draft or redraft
                    const isInitialAway = state.participants.every(p => p.roster.home.length > 0);

                    if (isInitialAway && state.participants.every(p => p.roster.away.length === 0 || p.roster.away.length === 1)) {
                        // Initial Draft Round 2 done (everyone has 1 home and is getting 1 away)
                        return {
                            ...state,
                            participants: updatedParticipants,
                            availablePlayers: {
                                ...state.availablePlayers,
                                [action.payload.teamSide]: state.availablePlayers[action.payload.teamSide].filter(pl => pl.id !== action.payload.player.id)
                            },
                            phase: 'REVIEW', // Go to Review
                            currentTurnIndex: 0
                        };
                    } else {
                        // Redraft for Away (TD scored, replacement drafted)
                        return {
                            ...state,
                            participants: updatedParticipants,
                            availablePlayers: {
                                ...state.availablePlayers,
                                [action.payload.teamSide]: state.availablePlayers[action.payload.teamSide].filter(pl => pl.id !== action.payload.player.id)
                            },
                            phase: 'LIVE', // Back to Live
                            currentTurnIndex: 0
                        };
                    }
                }
            }

            // Normal Pick, Next Turn
            return {
                ...state,
                participants: updatedParticipants,
                availablePlayers: {
                    ...state.availablePlayers,
                    [action.payload.teamSide]: state.availablePlayers[action.payload.teamSide].filter(pl => pl.id !== action.payload.player.id)
                },
                currentTurnIndex: nextTurnIndex
            };

        case 'REMOVE_PLAYER_FROM_ROSTER':
            // payload: { participantId, player, teamSide }
            return {
                ...state,
                participants: state.participants.map(p =>
                    p.id === action.payload.participantId
                        ? { ...p, roster: { ...p.roster, [action.payload.teamSide]: p.roster[action.payload.teamSide].filter(pl => pl.id !== action.payload.player.id) } }
                        : p
                ),
                // Optionally add back to available? Yes.
                availablePlayers: {
                    ...state.availablePlayers,
                    [action.payload.teamSide]: [...state.availablePlayers[action.payload.teamSide], action.payload.player]
                }
            };

        case 'ADD_MANUAL_PLAYER_TO_ROSTER':
            // payload: { participantId, player, teamSide }
            // player object should have { id, name, pos, num: 0 }
            return {
                ...state,
                participants: state.participants.map(p =>
                    p.id === action.payload.participantId
                        ? { ...p, roster: { ...p.roster, [action.payload.teamSide]: [...p.roster[action.payload.teamSide], action.payload.player] } }
                        : p
                )
            };

        // Player Pool Management (for pre-draft roster review)
        case 'REMOVE_PLAYER_FROM_POOL':
            // payload: { player, teamSide }
            return {
                ...state,
                availablePlayers: {
                    ...state.availablePlayers,
                    [action.payload.teamSide]: state.availablePlayers[action.payload.teamSide].filter(pl => pl.id !== action.payload.player.id)
                }
            };

        case 'ADD_PLAYER_TO_POOL':
            // payload: { player, teamSide }
            return {
                ...state,
                availablePlayers: {
                    ...state.availablePlayers,
                    [action.payload.teamSide]: [...state.availablePlayers[action.payload.teamSide], action.payload.player]
                }
            };

        case 'SWITCH_DRAFT_PHASE':
            // Deprecated by internal logic, but keeping as fallback
            return {
                ...state,
                draftPhase: 'AWAY',
                currentTurnIndex: 0,
                draftOrder: [...state.draftOrder].reverse() // Snake!
            };

        case 'Set_REVIEW_PHASE':
            return { ...state, phase: 'REVIEW' };

        case 'START_LIVE_GAME':
            // Ensure we clear any temp states
            return { ...state, phase: 'LIVE' };

        case 'START_NEXT_ROUND':
            // Logic moved to startNextRound async action
            return state;

        // Admin Edits
        case 'UPDATE_ANTE':
            return { ...state, ante: action.payload };

        case 'UPDATE_PLAYER_BALANCE':
            // payload: { id, balance }
            return {
                ...state,
                participants: state.participants.map(p =>
                    p.id === action.payload.id ? { ...p, balance: action.payload.balance } : p
                )
            };

        case 'UPDATE_PARTICIPANT_NAME':
            // payload: { id, name }
            return {
                ...state,
                participants: state.participants.map(p =>
                    p.id === action.payload.id ? { ...p, name: action.payload.name } : p
                )
            };

        // Scoring & Redraft
        case 'TOUCHDOWN_SCORED':
            // payload: { scoredByPlayerId, teamSide }
            // 1. Find owner
            const winner = state.participants.find(p =>
                p.roster[action.payload.teamSide].some(pl => pl.id === action.payload.scoredByPlayerId)
            );

            if (!winner) return state; // No one owned him?

            // 2. Award Pot
            const newParticipants = state.participants.map(p =>
                p.id === winner.id ? { ...p, balance: p.balance + state.pot, winnings: (p.winnings || 0) + 1 } : p
            );

            // 3. Reset Roster for Scoring Team ONLY
            const resetParticipants = newParticipants.map(p => ({
                ...p,
                roster: { ...p.roster, [action.payload.teamSide]: [] } // Clear scoring side
            }));

            // 4. Calculate New Draft Order (Winner Last, Rest Shuffled)
            const losers = resetParticipants.filter(p => p.id !== winner.id);
            // Simple shuffle
            const shuffledLosers = losers.sort(() => Math.random() - 0.5);
            const newOrder = [...shuffledLosers.map(p => p.id), winner.id];

            // 5. RESET AVAILABLE PLAYERS for scoring team back to original roster
            const resetAvailablePlayers = {
                ...state.availablePlayers,
                [action.payload.teamSide]: [...state.originalRoster[action.payload.teamSide]]
            };

            return {
                ...state,
                participants: resetParticipants,
                availablePlayers: resetAvailablePlayers, // Reset pool for scoring team
                pot: 0,
                phase: 'PAUSED', // Pause for Admin Review/Intermission
                draftPhase: action.payload.teamSide.toUpperCase(), // CRITICAL: Must match 'HOME'/'AWAY' format
                draftOrder: newOrder,
                currentTurnIndex: 0
            };

        case 'REMOVE_PARTICIPANT':
            // payload: participantId
            return {
                ...state,
                participants: state.participants.filter(p => p.id !== action.payload)
            };

        // =============================================
        // SUPABASE SYNC ACTIONS (from real-time updates)
        // =============================================

        case 'SYNC_ROOM':
            // Sync room state from Supabase real-time update
            // CRITICAL: Preserve myParticipantId - it should NEVER be reset by room sync
            const roomData = action.payload;
            return {
                ...state,
                phase: roomData.phase ?? state.phase,
                pot: roomData.pot ?? state.pot,
                ante: roomData.ante ?? state.ante,
                draftPhase: roomData.draft_phase ?? state.draftPhase,
                currentTurnIndex: roomData.current_turn_index ?? state.currentTurnIndex,
                draftOrder: roomData.draft_order ?? state.draftOrder,
                // game_data expansion
                teams: roomData.game_data?.teams ?? state.teams,
                availablePlayers: roomData.game_data?.availablePlayers ?? state.availablePlayers,
                originalRoster: roomData.game_data?.originalRoster ?? state.originalRoster,
                lastWinner: roomData.game_data?.lastWinner ?? state.lastWinner, // For winner notifications

                pendingCatchUp: roomData.game_data?.pendingCatchUp ?? state.pendingCatchUp, // If stored in game_data
                winnerId: roomData.winner_id ?? state.winnerId,
                // PRESERVE local identity - never reset these
                myParticipantId: state.myParticipantId,
                isAdmin: state.isAdmin
            };

        case 'SYNC_PARTICIPANT_ADD':
            // New participant joined from another device
            if (state.participants.find(p => p.id === action.payload.id)) {
                return state; // Already exists
            }
            const newP = action.payload;
            return {
                ...state,
                participants: [...state.participants, {
                    id: newP.id,
                    name: newP.name,
                    balance: newP.balance,
                    isAdmin: newP.is_admin,
                    roster: {
                        home: newP.roster_home || [],
                        away: newP.roster_away || []
                    }
                }]
            };

        case 'UPDATE_PARTICIPANT_ID':
            // Update local ID to match Supabase ID
            return {
                ...state,
                participants: state.participants.map(p =>
                    p.id === action.payload.oldId ? { ...p, id: action.payload.newId } : p
                ),
                draftOrder: state.draftOrder.map(id =>
                    id === action.payload.oldId ? action.payload.newId : id
                )
            };

        case 'SYNC_PARTICIPANT_UPDATE':
            // Participant updated from another device
            const updatedP = action.payload;
            return {
                ...state,
                participants: state.participants.map(p =>
                    p.id === updatedP.id
                        ? {
                            ...p,
                            name: updatedP.name !== undefined ? updatedP.name : p.name,
                            balance: updatedP.balance !== undefined ? updatedP.balance : p.balance,
                            winnings: updatedP.winnings !== undefined ? updatedP.winnings : p.winnings,
                            // Reconstruct roster if provided, otherwise keep existing
                            roster: (updatedP.roster_home || updatedP.roster_away)
                                ? { home: updatedP.roster_home || [], away: updatedP.roster_away || [] }
                                : p.roster
                        }
                        : p
                )
            };

        case 'SYNC_PARTICIPANT_REMOVE':
            // Participant removed from another device
            return {
                ...state,
                participants: state.participants.filter(p => p.id !== action.payload.id)
            };

        case 'RESET_STATE':
            return initialState;

        default:
            return state;
    }
}

export function GameProvider({ children }) {
    const [state, dispatch] = useReducer(gameReducer, initialState);
    const roomIdRef = useRef(null); // Store Supabase room ID
    const isSyncingRef = useRef(false); // Prevent sync loops

    // Create room - now writes to Supabase
    const createRoom = async () => {
        const code = generateCode();
        dispatch({ type: 'CREATE_ROOM', payload: code });

        // Write to Supabase if connected
        if (isLive) {
            const gameData = {
                teams: state.teams,
                availablePlayers: state.availablePlayers,
                originalRoster: state.originalRoster
            };
            const { data, error } = await createRoomDb(code, gameData, state.ante);
            if (data) {
                roomIdRef.current = data.id;
                dispatch({ type: 'SET_ROOM_ID', payload: data.id });
                saveSession(code, 'ADMIN'); // Admin doesn't have a participant ID in 'participants' table yet, wait... 
                // Actually Admin creates a participant record immediately after in 'addParticipant'.
                // So we should save after addParticipant.
                console.log('✅ Room created in Supabase:', data.id);
            } else if (error) {
                console.error('❌ Failed to create room in Supabase:', error);
            }
        }
    };

    const addParticipant = async (name, initialBalance) => {
        const localId = generateCode();
        const p = {
            id: localId,
            name,
            balance: initialBalance,
            roster: { home: [], away: [] }
        };
        dispatch({ type: 'ADD_PARTICIPANT', payload: p });

        // Write to Supabase if connected
        if (isLive && roomIdRef.current) {
            const isFirstParticipant = state.participants.length === 0;
            const { data, error } = await addParticipantDb(
                roomIdRef.current,
                name,
                initialBalance,
                isFirstParticipant // First participant is admin
            );
            if (data) {
                // Update local ID to match Supabase ID for sync
                dispatch({ type: 'UPDATE_PARTICIPANT_ID', payload: { oldId: localId, newId: data.id } });

                // Save session now that we have ID
                if (state.roomCode) {
                    saveSession(state.roomCode, data.id);
                }

                console.log('✅ Participant added in Supabase:', data.id);
            } else if (error) {
                console.error('❌ Failed to add participant in Supabase:', error);
            }
        }
    };

    const startDraft = async () => {
        dispatch({ type: 'COLLECT_ANTE' });

        if (isLive && state.roomId) {
            // 1. Deduct Ante from all participants
            const deductionPromises = state.participants.map(p =>
                updateParticipant(p.id, { balance: p.balance - state.ante })
            );
            await Promise.all(deductionPromises);

            // 2. Update Room State
            const totalCollected = state.participants.length * state.ante;
            // Randomize initial draft order
            const draftOrder = [...state.participants.map(p => p.id)].sort(() => Math.random() - 0.5);

            await updateRoom(state.roomId, {
                phase: 'DRAFT',
                draft_phase: 'HOME',
                current_turn_index: 0,
                pot: (state.pot || 0) + totalCollected,
                draft_order: draftOrder
            });
        }
    };

    const startNextRound = async () => {
        if (!isLive || !state.roomId) return;

        // 1. Determine scoring team (redraft) vs non-scoring team
        const redraftSide = state.draftPhase === 'HOME' ? 'home' : 'away';
        const nonRedraftSide = redraftSide === 'home' ? 'away' : 'home';

        // 2. Find new participants who need catch-up (missing player on non-scoring team)
        const needsCatchUp = state.participants.filter(p => p.roster[nonRedraftSide].length === 0);

        // 3. Update Participants (Deduct Ante + Clear Rosters for Redraft Side)
        const participantUpdatePromises = state.participants.map(p =>
            updateParticipant(p.id, {
                balance: p.balance - state.ante,
                [`roster_${redraftSide}`]: [] // Clear roster for redraft side
            })
        );
        await Promise.all(participantUpdatePromises);

        // 4. Calculate New Draft Order
        // Touchdown logic already set draftOrder to [shuffled losers..., winner]
        // We just need to inject NEW participants into the "losers" pool
        const existingOrder = state.draftOrder;
        // Safety check if order is empty
        if (existingOrder.length === 0) {
            console.error("Previous draft order is empty, cannot determination Start Next Round order safely.");
            return;
        }

        const winnerId = existingOrder[existingOrder.length - 1];
        const newParticipantIds = state.participants
            .filter(p => !existingOrder.includes(p.id))
            .map(p => p.id);

        let finalDraftOrder = existingOrder;
        if (newParticipantIds.length > 0) {
            const losersWithNew = [...existingOrder.slice(0, -1), ...newParticipantIds]
                .sort(() => Math.random() - 0.5); // Shuffle losers + new
            finalDraftOrder = [...losersWithNew, winnerId];
        }

        // 5. Calculate Pot
        const totalRoundAnte = state.participants.length * state.ante;
        const newPot = (state.pot || 0) + totalRoundAnte;

        // 6. Pending Catch-up
        const pendingCatchUp = needsCatchUp.length > 0 ? {
            participantIds: needsCatchUp.map(p => p.id).sort(() => Math.random() - 0.5),
            teamSide: nonRedraftSide
        } : null;

        // 7. RESET Available Players for the Redraft Side from Original Roster
        const resetAvailablePlayers = {
            ...state.availablePlayers,
            [redraftSide]: [...state.originalRoster[redraftSide]]
        };

        // 8. Sync to Room
        await updateRoom(state.roomId, {
            phase: 'DRAFT',
            pot: newPot,
            draft_phase: redraftSide.toUpperCase(),
            current_turn_index: 0,
            draft_order: finalDraftOrder,
            game_data: {
                teams: state.teams,
                availablePlayers: resetAvailablePlayers, // FIXED: Reset from original
                originalRoster: state.originalRoster,
                pendingCatchUp: pendingCatchUp // Store in game_data
            }
        });
    };



    const removeParticipant = (id) => {
        dispatch({ type: 'REMOVE_PARTICIPANT', payload: id });
    };

    const updateAnte = async (amount) => {
        dispatch({ type: 'UPDATE_ANTE', payload: amount });

        if (isLive && state.roomId) {
            await updateRoom(state.roomId, { ante: amount });
        }
    };

    const updatePlayerBalance = (id, balance) => {
        dispatch({ type: 'UPDATE_PLAYER_BALANCE', payload: { id, balance } });
    };

    const updateParticipantName = async (id, name) => {
        dispatch({ type: 'UPDATE_PARTICIPANT_NAME', payload: { id, name } });
        if (isLive && state.roomId) {
            await updateParticipant(id, { name });
        }
    };

    const removePlayerFromRoster = (participantId, player, teamSide) => {
        dispatch({ type: 'REMOVE_PLAYER_FROM_ROSTER', payload: { participantId, player, teamSide } });
    };

    const addManualPlayerToRoster = (participantId, name, teamSide) => {
        const player = { id: generateCode(), name, pos: 'MANUAL', num: 0 };
        dispatch({ type: 'ADD_MANUAL_PLAYER_TO_ROSTER', payload: { participantId, player, teamSide } });
    };

    const makePick = async (participantId, player, teamSide) => {
        dispatch({ type: 'MAKE_PICK', payload: { participantId, player, teamSide } });

        if (isLive && state.roomId) {
            // 1. Update Participant Roster
            const participant = state.participants.find(p => p.id === participantId);
            if (participant) {
                const newRosterSide = [...participant.roster[teamSide], player];
                await updateParticipant(participantId, {
                    [`roster_${teamSide}`]: newRosterSide
                });
            }

            // 2. Calculate Room Updates (Available Players & Turn/Phase)
            const newAvailable = {
                ...state.availablePlayers,
                [teamSide]: state.availablePlayers[teamSide].filter(p => p.id !== player.id)
            };

            let nextTurnIndex = state.currentTurnIndex + 1;
            let nextDraftPhase = state.draftPhase;
            let nextDraftOrder = state.draftOrder;
            let nextPhase = state.phase;

            // Simple transition logic mirroring reducer
            // Note: This duplicates reducer logic. In production, refactor into shared pure function.
            const isRoundComplete = nextTurnIndex >= state.draftOrder.length;

            if (isRoundComplete) {
                // If HOME done, switch to AWAY snake
                if (state.draftPhase === 'HOME') {
                    // Check if simple initial draft (everyone has 0 away)
                    const isInitial = state.participants.every(p => p.roster.away.length === 0);
                    if (isInitial) {
                        nextDraftPhase = 'AWAY';
                        nextTurnIndex = 0;
                        nextDraftOrder = [...state.draftOrder].reverse();
                    } else {
                        nextPhase = 'LIVE';
                        nextTurnIndex = 0;
                    }
                } else if (state.draftPhase === 'AWAY') {
                    // If AWAY done, go to REVIEW (if initial)
                    const isInitial = state.participants.every(p => p.roster.home.length > 0);
                    if (isInitial) {
                        nextPhase = 'REVIEW';
                        nextTurnIndex = 0;
                    } else {
                        nextPhase = 'LIVE';
                        nextTurnIndex = 0;
                    }
                }
            }

            await updateRoom(state.roomId, {
                game_data: {
                    teams: state.teams,
                    availablePlayers: newAvailable,
                    originalRoster: state.originalRoster
                },
                current_turn_index: nextTurnIndex,
                draft_phase: nextDraftPhase,
                draft_order: nextDraftOrder,
                phase: nextPhase
            });
        }
    };

    const handleScore = async (playerId, teamSide) => {
        dispatch({ type: 'TOUCHDOWN_SCORED', payload: { scoredByPlayerId: playerId, teamSide } });

        if (isLive && state.roomId) {
            // 1. Find Winner and Scoring Player
            const winner = state.participants.find(p =>
                p.roster[teamSide].some(pl => pl.id === playerId)
            );
            if (!winner) return;

            const scoringPlayer = winner.roster[teamSide].find(pl => pl.id === playerId);

            // 2. Prepare Updates (Participants)
            const participantUpdates = state.participants.map(p => {
                let updates = {
                    [`roster_${teamSide}`]: [] // Clear this side for everyone
                };
                if (p.id === winner.id) {
                    updates.balance = p.balance + (state.pot || 0);
                    updates.winnings = (p.winnings || 0) + 1;
                }
                return updateParticipant(p.id, updates);
            });
            await Promise.all(participantUpdates);

            // 3. Draft Order Logic (Winner Last, Losers Shuffled)
            const losers = state.participants.filter(p => p.id !== winner.id);
            const shuffledLosers = losers.map(p => p.id).sort(() => Math.random() - 0.5);
            const newDraftOrder = [...shuffledLosers, winner.id];

            // 4. Update Room with lastWinner for notifications
            const resetAvailablePlayers = {
                ...state.availablePlayers,
                [teamSide]: [...state.originalRoster[teamSide]]
            };

            await updateRoom(state.roomId, {
                pot: 0,
                phase: 'PAUSED',
                draft_phase: teamSide.toUpperCase(), // e.g. 'HOME'
                draft_order: newDraftOrder,
                current_turn_index: 0,
                game_data: {
                    teams: state.teams,
                    availablePlayers: resetAvailablePlayers,
                    originalRoster: state.originalRoster,
                    lastWinner: {
                        participantId: winner.id,
                        participantName: winner.name,
                        playerName: scoringPlayer?.name || 'Unknown',
                        potWon: state.pot,
                        timestamp: Date.now()
                    }
                }
            });
        }
    };

    const startGame = () => {
        dispatch({ type: 'START_LIVE_GAME' });
    }

    const removePlayerFromPool = (player, teamSide) => {
        dispatch({ type: 'REMOVE_PLAYER_FROM_POOL', payload: { player, teamSide } });
    };

    const addPlayerToPool = (name, teamSide) => {
        const player = { id: generateCode(), name, pos: 'MANUAL', num: 0 };
        dispatch({ type: 'ADD_PLAYER_TO_POOL', payload: { player, teamSide } });
    };

    const claimFreeAgent = async (participantId, player, teamSide) => {
        // UI Optimistic Update (uses updated MAKE_PICK reducer)
        dispatch({ type: 'MAKE_PICK', payload: { participantId, player, teamSide } });

        if (isLive && state.roomId) {
            // 1. Update Participant Roster
            const participant = state.participants.find(p => p.id === participantId);
            if (participant) {
                const newRosterSide = [...participant.roster[teamSide], player];
                await updateParticipant(participantId, {
                    [`roster_${teamSide}`]: newRosterSide
                });
            }

            // 2. Remove From Available Pool
            const newAvailable = {
                ...state.availablePlayers,
                [teamSide]: state.availablePlayers[teamSide].filter(p => p.id !== player.id)
            };

            await updateRoom(state.roomId, {
                game_data: {
                    teams: state.teams,
                    availablePlayers: newAvailable,
                    originalRoster: state.originalRoster
                }
            });
        }
    };

    // Auto-Rejoin Persistence
    const saveSession = (code, pid) => {
        localStorage.setItem('football_draft_session', JSON.stringify({ roomCode: code, participantId: pid }));
    };

    const rejoinGame = async (code, participantId) => {
        const { data: room, error } = await getRoomByCode(code);
        if (error || !room) {
            console.error('❌ Rejoin failed: Room not found');
            localStorage.removeItem('football_draft_session');
            return;
        }

        const { data: participants, error: pError } = await getParticipantsByRoom(room.id);
        if (pError) return;

        const me = participants.find(p => p.id === participantId);
        if (!me) {
            localStorage.removeItem('football_draft_session');
            return;
        }

        console.log('✅ Rejoin successful:', me.name);

        dispatch({
            type: 'JOIN_ROOM',
            payload: {
                code,
                roomId: room.id,
                phase: room.phase,
                pot: room.pot,
                ante: room.ante,
                draftPhase: room.draft_phase,
                currentTurnIndex: room.current_turn_index,
                draftOrder: room.draft_order,
                teams: room.game_data.teams,
                availablePlayers: room.game_data.availablePlayers,
                originalRoster: room.game_data.originalRoster,
                winnerId: room.winner_id
            }
        });

        if (me.is_admin) {
            dispatch({ type: 'SET_ADMIN' });
        }

        participants.forEach(p => {
            dispatch({ type: 'SYNC_PARTICIPANT_ADD', payload: p });
        });
    };

    // Auto-Rejoin Effect
    useEffect(() => {
        const checkRejoin = async () => {
            const saved = JSON.parse(localStorage.getItem('football_draft_session'));
            if (saved && saved.roomCode && saved.participantId && !state.roomId) {
                console.log('🔄 Attempting to rejoin session:', saved);
                await rejoinGame(saved.roomCode, saved.participantId);
            }
        };
        checkRejoin();
    }, []);

    // Real-time Subscription
    useEffect(() => {
        // Only subscribe if we are live, we have a room code, and we have a room ID
        if (!isLive || !state.roomCode || !state.roomId) return;

        console.log('🔌 Subscribing to room:', state.roomId);
        const unsubscribe = subscribeToRoom(
            state.roomId,
            (payload) => {
                // Handle Room Changes
                console.log('📥 Room Update Received:', payload);
                if (payload.eventType === 'UPDATE') {
                    dispatch({ type: 'SYNC_ROOM', payload: payload.new });
                }
            },
            (payload) => {
                // Handle Participant Changes
                console.log('📥 Participant Update Received:', payload);
                if (payload.eventType === 'INSERT') dispatch({ type: 'SYNC_PARTICIPANT_ADD', payload: payload.new });
                if (payload.eventType === 'UPDATE') dispatch({ type: 'SYNC_PARTICIPANT_UPDATE', payload: payload.new });
                if (payload.eventType === 'DELETE') dispatch({ type: 'SYNC_PARTICIPANT_REMOVE', payload: payload.old });
            }
        );

        return () => {
            console.log('🔌 Unsubscribing...');
            unsubscribe();
        };
    }, [state.roomCode, state.roomId]); // Depend on roomId to start subscription

    /**
     * Join an existing room by code (for non-admin players)
     * @param {string} code - Room code to join
     * @param {string} playerName - Name of the joining player
     * @param {number} buyIn - Initial balance (tokens)
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    const joinRoom = async (code, playerName, buyIn = 0) => {
        console.log('🔍 joinRoom called:', { code, playerName, isLive });

        if (!isLive) {
            console.error('❌ Supabase not configured, isLive =', isLive);
            return { success: false, error: 'Supabase not configured' };
        }

        // 1. Look up room by code
        console.log('🔍 Looking up room by code:', code.toUpperCase());
        const { data: room, error: roomError } = await getRoomByCode(code.toUpperCase());
        console.log('🔍 getRoomByCode result:', { room, roomError });

        if (roomError || !room) {
            console.error('❌ Room not found:', roomError);
            return { success: false, error: 'Room not found. Check the code and try again.' };
        }

        roomIdRef.current = room.id;
        console.log('✅ Found room:', room.id);

        // 2. Fetch existing participants
        const { data: participants } = await getParticipantsByRoom(room.id);

        // 3. Add self as participant
        const { data: newParticipant, error: participantError } = await addParticipantDb(
            room.id,
            playerName,
            buyIn,
            false // Not admin
        );

        if (participantError || !newParticipant) {
            console.error('❌ Failed to join:', participantError);
            return { success: false, error: 'Failed to join room. Try again.' };
        }

        console.log('✅ Joined as:', newParticipant.id);

        // LATE JOINER: Catch-up Logic
        if (room.phase === 'DRAFT') {
            const currentOrder = room.draft_order || [];
            // Only append if not already there (safety)
            if (!currentOrder.includes(newParticipant.id)) {
                console.log('⏳ Late Joiner: Appending to Draft Order');
                const newOrder = [...currentOrder, newParticipant.id];
                await updateRoom(room.id, { draft_order: newOrder });
            }
        }

        // Save session
        saveSession(code, newParticipant.id);

        // 4. Sync local state with room data
        dispatch({
            type: 'JOIN_ROOM',
            payload: {
                code: room.code,
                roomId: room.id,
                phase: room.phase,
                pot: room.pot,
                ante: room.ante,
                draftPhase: room.draft_phase,
                currentTurnIndex: room.current_turn_index,
                draftOrder: room.draft_order || [],
                teams: room.game_data?.teams,
                availablePlayers: room.game_data?.availablePlayers,
                originalRoster: room.game_data?.originalRoster,
                participants: [
                    ...(participants || []).map(p => ({
                        id: p.id,
                        name: p.name,
                        balance: p.balance,
                        roster: { home: p.roster_home || [], away: p.roster_away || [] }
                    })),
                    {
                        id: newParticipant.id,
                        name: playerName,
                        balance: buyIn,
                        roster: { home: [], away: [] }
                    }
                ],
                myParticipantId: newParticipant.id
            }
        });

        return { success: true };
    };

    const setAdmin = () => {
        dispatch({ type: 'SET_ADMIN' });
    };

    const leaveRoom = () => {
        localStorage.removeItem('football_draft_session');
        dispatch({ type: 'RESET_STATE' });
    };

    return (
        <GameContext.Provider value={{
            state,
            dispatch,
            createRoom,
            setAdmin,
            addParticipant,
            startDraft,
            makePick,
            handleScore,
            removeParticipant,
            startNextRound,
            updateAnte,
            updatePlayerBalance,
            updateParticipantName,
            startGame,
            removePlayerFromRoster,
            addManualPlayerToRoster,
            addPlayerToPool,
            claimFreeAgent,
            joinRoom,
            leaveRoom
        }}>
            {children}
        </GameContext.Provider>
    );
}

export const useGame = () => useContext(GameContext);
