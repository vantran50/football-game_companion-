-- =============================================
-- Football Draft Companion - Supabase Schema
-- Run this in Supabase SQL Editor
-- =============================================

-- Rooms table
CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    phase TEXT DEFAULT 'SETUP',
    pot INTEGER DEFAULT 0,
    ante INTEGER DEFAULT 5,
    draft_phase TEXT DEFAULT 'HOME',
    current_turn_index INTEGER DEFAULT 0,
    draft_order TEXT[],
    game_data JSONB,
    pending_catch_up JSONB,
    winner_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Participants table
CREATE TABLE participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    balance INTEGER DEFAULT 0,
    roster_home JSONB DEFAULT '[]',
    roster_away JSONB DEFAULT '[]',
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;

-- Allow anonymous access (for simplicity)
CREATE POLICY "Allow all access to rooms" ON rooms FOR ALL USING (true);
CREATE POLICY "Allow all access to participants" ON participants FOR ALL USING (true);

-- Enable real-time subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE participants;
