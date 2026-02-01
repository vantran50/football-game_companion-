import { useEffect, useCallback, useRef } from 'react';
import {
    supabase,
    isLive,
    getRoomByCode,
    getParticipantsByRoom,
    createRoom as createRoomDb,
    addParticipant as addParticipantDb,
    updateRoom,
    updateParticipant,
    subscribeToRoom
} from '../lib/supabaseClient';

/**
 * Hook to sync game state with Supabase
 * 
 * @param {object} state - Current game state from reducer
 * @param {function} dispatch - Dispatch function from reducer
 * @returns {object} - { syncRoom, syncParticipant, isConnected }
 */
export function useRoom(state, dispatch) {
    const roomIdRef = useRef(null);
    const unsubscribeRef = useRef(null);
    const isSyncingRef = useRef(false); // Prevent sync loops

    // Track if we're connected to Supabase
    const isConnected = isLive && !!roomIdRef.current;

    /**
     * Create a new room in Supabase
     */
    const createRemoteRoom = useCallback(async (code, gameData) => {
        if (!isLive) return null;

        const { data, error } = await createRoomDb(code, gameData);
        if (error) {
            console.error('Failed to create room:', error);
            return null;
        }

        roomIdRef.current = data.id;
        return data;
    }, []);

    /**
     * Join an existing room by code
     */
    const joinRemoteRoom = useCallback(async (code) => {
        if (!isLive) return null;

        const { data, error } = await getRoomByCode(code);
        if (error) {
            console.error('Failed to join room:', error);
            return null;
        }

        roomIdRef.current = data.id;

        // Fetch participants
        const { data: participants } = await getParticipantsByRoom(data.id);

        return { room: data, participants };
    }, []);

    /**
     * Sync room state changes to Supabase
     */
    const syncRoom = useCallback(async (updates) => {
        if (!isLive || !roomIdRef.current || isSyncingRef.current) return;

        // Map local state keys to DB column names
        const dbUpdates = {};
        if (updates.phase !== undefined) dbUpdates.phase = updates.phase;
        if (updates.pot !== undefined) dbUpdates.pot = updates.pot;
        if (updates.ante !== undefined) dbUpdates.ante = updates.ante;
        if (updates.draftPhase !== undefined) dbUpdates.draft_phase = updates.draftPhase;
        if (updates.currentTurnIndex !== undefined) dbUpdates.current_turn_index = updates.currentTurnIndex;
        if (updates.draftOrder !== undefined) dbUpdates.draft_order = updates.draftOrder;
        if (updates.availablePlayers !== undefined || updates.teams !== undefined) {
            // Merge into game_data JSONB
            dbUpdates.game_data = {
                teams: updates.teams,
                availablePlayers: updates.availablePlayers,
                originalRoster: updates.originalRoster
            };
        }
        if (updates.pendingCatchUp !== undefined) dbUpdates.pending_catch_up = updates.pendingCatchUp;
        if (updates.winnerId !== undefined) dbUpdates.winner_id = updates.winnerId;

        if (Object.keys(dbUpdates).length === 0) return;

        await updateRoom(roomIdRef.current, dbUpdates);
    }, []);

    /**
     * Sync participant changes to Supabase
     */
    const syncParticipant = useCallback(async (participantId, updates) => {
        if (!isLive || isSyncingRef.current) return;

        const dbUpdates = {};
        if (updates.balance !== undefined) dbUpdates.balance = updates.balance;
        if (updates.roster?.home !== undefined) dbUpdates.roster_home = updates.roster.home;
        if (updates.roster?.away !== undefined) dbUpdates.roster_away = updates.roster.away;

        if (Object.keys(dbUpdates).length === 0) return;

        await updateParticipant(participantId, dbUpdates);
    }, []);

    /**
     * Add participant to room
     */
    const addRemoteParticipant = useCallback(async (name, balance, isAdmin = false) => {
        if (!isLive || !roomIdRef.current) return null;

        const { data, error } = await addParticipantDb(roomIdRef.current, name, balance, isAdmin);
        if (error) {
            console.error('Failed to add participant:', error);
            return null;
        }

        return data;
    }, []);

    // Setup real-time subscription when room is joined
    useEffect(() => {
        if (!isLive || !roomIdRef.current) return;

        const handleRoomChange = (payload) => {
            if (payload.eventType === 'UPDATE' && payload.new) {
                isSyncingRef.current = true;

                // Map DB columns back to local state
                const room = payload.new;
                dispatch({
                    type: 'SYNC_ROOM',
                    payload: {
                        phase: room.phase,
                        pot: room.pot,
                        ante: room.ante,
                        draftPhase: room.draft_phase,
                        currentTurnIndex: room.current_turn_index,
                        draftOrder: room.draft_order || [],
                        teams: room.game_data?.teams,
                        availablePlayers: room.game_data?.availablePlayers,
                        pendingCatchUp: room.pending_catch_up,
                        winnerId: room.winner_id
                    }
                });

                setTimeout(() => { isSyncingRef.current = false; }, 100);
            }
        };

        const handleParticipantChange = (payload) => {
            isSyncingRef.current = true;

            if (payload.eventType === 'INSERT' && payload.new) {
                const p = payload.new;
                dispatch({
                    type: 'SYNC_PARTICIPANT_ADD',
                    payload: {
                        id: p.id,
                        name: p.name,
                        balance: p.balance,
                        roster: { home: p.roster_home || [], away: p.roster_away || [] }
                    }
                });
            } else if (payload.eventType === 'UPDATE' && payload.new) {
                const p = payload.new;
                dispatch({
                    type: 'SYNC_PARTICIPANT_UPDATE',
                    payload: {
                        id: p.id,
                        balance: p.balance,
                        roster: { home: p.roster_home || [], away: p.roster_away || [] }
                    }
                });
            } else if (payload.eventType === 'DELETE' && payload.old) {
                dispatch({
                    type: 'SYNC_PARTICIPANT_REMOVE',
                    payload: { id: payload.old.id }
                });
            }

            setTimeout(() => { isSyncingRef.current = false; }, 100);
        };

        unsubscribeRef.current = subscribeToRoom(
            roomIdRef.current,
            handleRoomChange,
            handleParticipantChange
        );

        return () => {
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
            }
        };
    }, [dispatch, roomIdRef.current]);

    return {
        createRemoteRoom,
        joinRemoteRoom,
        addRemoteParticipant,
        syncRoom,
        syncParticipant,
        isConnected,
        isLive
    };
}
