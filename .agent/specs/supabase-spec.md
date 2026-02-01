# Supabase Integration Spec

## Goal
Add real-time multiplayer support so participants on different devices can join the same room and see live updates.

## Current State

**State management:** [GameContext.jsx](file:///Users/van/Documents/football%20app/src/context/GameContext.jsx)
- All state is local (in-memory React state)
- Already has `supabase.js` stub at `src/lib/supabase.js`

**Key state shape:**
```javascript
{
    roomCode: string,
    phase: 'SETUP' | 'DRAFT' | 'LIVE' | 'PAUSED' | 'REVIEW',
    participants: [{ id, name, balance, roster: { home: [], away: [] } }],
    pot: number,
    ante: number,
    draftOrder: string[],
    currentTurnIndex: number,
    draftPhase: 'HOME' | 'AWAY',
    availablePlayers: { home: [], away: [] }
}
```

## Proposed Database Schema

```sql
-- Rooms
CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    phase TEXT DEFAULT 'SETUP',
    pot INTEGER DEFAULT 0,
    ante INTEGER DEFAULT 5,
    draft_phase TEXT DEFAULT 'HOME',
    current_turn_index INTEGER DEFAULT 0,
    draft_order TEXT[], -- Array of participant IDs
    game_data JSONB, -- { teams, availablePlayers, originalRoster }
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Participants
CREATE TABLE participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    balance INTEGER DEFAULT 0,
    roster_home JSONB DEFAULT '[]',
    roster_away JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Files to Modify

1. **Update** `src/lib/supabase.js` - Client init + CRUD helpers
2. **Create** `src/hooks/useRoom.js` - Real-time subscription hook
3. **Modify** `GameContext.jsx` - Sync local state with Supabase

## Real-time Subscriptions

```javascript
supabase
    .channel('room:${roomCode}')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, handleRoomChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'participants' }, handleParticipantChange)
    .subscribe();
```

## Implementation Notes

- Use anonymous auth or no auth for simplicity
- Room creator becomes admin (store in localStorage)
- On state change, dispatch to reducer AND write to Supabase
- On Supabase change, update local state (avoid loops)
