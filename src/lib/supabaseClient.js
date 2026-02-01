import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// --- Room Operations ---

export async function createRoomDb(code, adminName) {
    // Phase 1: Create Room
    const { data: room, error: roomError } = await supabase
        .from('rooms')
        .insert({
            code,
            phase: 'SETUP',
            ante: 0,
            pot: 0,
            current_turn_index: 0,
            teams: { home: '', away: '' },
            available_players: { home: [], away: [] }
        })
        .select()
        .single();

    if (roomError) return { error: roomError };

    return { data: room };
}

export async function getRoomByCode(code) {
    return await supabase
        .from('rooms')
        .select('*')
        .eq('code', code)
        .single();
}

export async function updateRoom(roomId, updates) {
    return await supabase
        .from('rooms')
        .update(updates)
        .eq('id', roomId);
}

// --- Participant Operations ---

export async function addParticipantDb(roomId, name, isAdmin = false) {
    return await supabase
        .from('participants')
        .insert({
            room_id: roomId,
            name: name,
            balance: 50, // Default buy-in
            is_admin: isAdmin,
            roster_home: [],
            roster_away: []
        })
        .select()
        .single();
}

export async function getParticipantsByRoom(roomId) {
    return await supabase
        .from('participants')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });
}

export async function updateParticipant(participantId, updates) {
    return await supabase
        .from('participants')
        .update(updates)
        .eq('id', participantId);
}

export async function subscribeToRoom(roomId, onRoomUpdate, onParticipantsUpdate) {
    const roomChannel = supabase
        .channel(`room:${roomId}`)
        .on('postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
            (payload) => {
                console.log('📡 Room Update:', payload.new);
                onRoomUpdate(payload.new);
            }
        )
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'participants', filter: `room_id=eq.${roomId}` },
            async () => {
                // Fetch fresh list to ensure consistency
                const { data } = await getParticipantsByRoom(roomId);
                if (data) {
                    console.log('👥 Participants Sync:', data.length);
                    onParticipantsUpdate(data);
                }
            }
        )
        .subscribe();

    return () => supabase.removeChannel(roomChannel);
}
