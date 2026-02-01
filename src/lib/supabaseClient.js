import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Export typed client if needed, or raw client
export const supabase = (supabaseUrl && supabaseKey)
    ? createClient(supabaseUrl, supabaseKey, {
        auth: {
            persistSession: false // Disable auth persistence for this anonymous-only app
        }
    })
    : null;

export const isLive = !!supabase;

// Helper to log if we are in Mock Mode
if (!isLive) {
    console.warn("⚠️ SUPABASE KEYS MISSING. Running in local MOCK mode.");
}

// =============================================
// ROOM CRUD OPERATIONS
// =============================================

/**
 * Create a new room with a unique code
 */
export async function createRoom(code, gameData = null, ante = 2) {
    if (!supabase) return { data: null, error: 'Supabase not configured' };

    const { data, error } = await supabase
        .from('rooms')
        .insert({
            code: code,
            phase: 'SETUP',
            pot: 0,
            ante: ante, // Use passed ante instead of hardcoded value
            draft_phase: 'HOME',
            current_turn_index: 0,
            draft_order: [],
            game_data: gameData
        })
        .select()
        .single();

    return { data, error };
}

/**
 * Get a room by its code
 */
export async function getRoomByCode(code) {
    console.log('⚡️ getRoomByCode START:', code);
    if (!supabase) return { data: null, error: 'Supabase not configured' };

    try {
        // Create a timeout promise to detect hangs
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Supabase query timed out after 5s')), 5000)
        );

        const queryPromise = supabase
            .from('rooms')
            .select('*')
            .eq('code', code)
            .maybeSingle(); // Use maybeSingle to avoid error when no rows found

        console.log('⚡️ Awaiting query...');
        const result = await Promise.race([queryPromise, timeoutPromise]);

        console.log('⚡️ Query RESOLVED:', result);
        return result;
    } catch (err) {
        console.error('⚡️ getRoomByCode ERROR:', err);
        return { data: null, error: err.message };
    }
}

/**
 * Update room state
 */
export async function updateRoom(roomId, updates) {
    if (!supabase) return { data: null, error: 'Supabase not configured' };

    const { data, error } = await supabase
        .from('rooms')
        .update(updates)
        .eq('id', roomId)
        .select()
        .single();

    return { data, error };
}

// =============================================
// PARTICIPANT CRUD OPERATIONS
// =============================================

/**
 * Add a participant to a room
 */
export async function addParticipant(roomId, name, balance, isAdmin = false) {
    if (!supabase) return { data: null, error: 'Supabase not configured' };

    try {
        const { data, error } = await supabase
            .from('participants')
            .insert({
                room_id: roomId,
                name: name,
                balance: balance,
                roster_home: [],
                roster_away: [],
                is_admin: isAdmin
            })
            .select()
            .single();

        return { data, error };
    } catch (err) {
        console.error('addParticipant exception:', err);
        return { data: null, error: err.message };
    }
}

/**
 * Get all participants in a room
 */
export async function getParticipantsByRoom(roomId) {
    if (!supabase) return { data: [], error: 'Supabase not configured' };

    const { data, error } = await supabase
        .from('participants')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

    return { data: data || [], error };
}

/**
 * Update a participant
 */
export async function updateParticipant(participantId, updates) {
    if (!supabase) return { data: null, error: 'Supabase not configured' };

    const { data, error } = await supabase
        .from('participants')
        .update(updates)
        .eq('id', participantId)
        .select()
        .single();

    return { data, error };
}

/**
 * Remove a participant from a room
 */
export async function removeParticipant(participantId) {
    if (!supabase) return { error: 'Supabase not configured' };

    const { error } = await supabase
        .from('participants')
        .delete()
        .eq('id', participantId);

    return { error };
}

// =============================================
// REAL-TIME SUBSCRIPTIONS
// =============================================

/**
 * Subscribe to room and participant changes
 * @param {string} roomId - The room ID to subscribe to
 * @param {function} onRoomChange - Callback for room updates
 * @param {function} onParticipantChange - Callback for participant updates
 * @returns {function} Unsubscribe function
 */
export function subscribeToRoom(roomId, onRoomChange, onParticipantChange) {
    if (!supabase) {
        console.warn('Supabase not configured, skipping subscription');
        return () => { };
    }

    const channel = supabase
        .channel(`room:${roomId}`)
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
            (payload) => {
                console.log('Room change:', payload);
                onRoomChange(payload);
            }
        )
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'participants', filter: `room_id=eq.${roomId}` },
            (payload) => {
                console.log('Participant change:', payload);
                onParticipantChange(payload);
            }
        )
        .subscribe();

    // Return unsubscribe function
    return () => {
        supabase.removeChannel(channel);
    };
}
