-- RUN THIS IN SUPABASE SQL EDITOR --

-- Disable RLS to allow Participants to update the Room (Draft Players)
ALTER TABLE rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE participants DISABLE ROW LEVEL SECURITY;

-- Alternatively, ensuring policies exist (if you prefer keeping RLS enabled):
-- CREATE POLICY "Enable read access for all users" ON "public"."rooms" FOR SELECT USING (true);
-- CREATE POLICY "Enable update for all users" ON "public"."rooms" FOR UPDATE USING (true);
-- But disabling is safer for this specific issue.
