-- RUN THIS IN SUPABASE SQL EDITOR --

-- Essential: Add tables to the realtime publication so updates are broadcast called 'postgres_changes'
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE participants;

-- Verify replication identity is set (usually default is fine, but forceful is safer for updates)
ALTER TABLE rooms REPLICA IDENTITY FULL;
ALTER TABLE participants REPLICA IDENTITY FULL;

-- This ensures that when 'phase' changes from DRAFT -> LIVE, the phone receives it.
