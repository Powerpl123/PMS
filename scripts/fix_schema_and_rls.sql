-- ============================================================
-- PMS Schema Fix: Add kks_code column + Fix RLS policies
-- Run this in Supabase SQL Editor:
--   https://supabase.com/dashboard/project/evaqhozshdnimhejfwzy/sql/new
-- ============================================================

-- 1. Add kks_code column to assets table (if it doesn't exist)
ALTER TABLE assets ADD COLUMN IF NOT EXISTS kks_code text;

-- 2. Add unique constraint on kks_code
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'assets_kks_code_key'
  ) THEN
    CREATE UNIQUE INDEX assets_kks_code_key ON assets (kks_code);
  END IF;
END $$;

-- 3. Fix RLS policies — allow both anon and authenticated full access
--    (service_role key bypasses RLS, but anon key needs these policies)

-- Assets
DROP POLICY IF EXISTS "Authenticated users full access" ON assets;
DROP POLICY IF EXISTS "Allow full access" ON assets;
CREATE POLICY "Allow full access" ON assets FOR ALL USING (true) WITH CHECK (true);

-- Work Orders
DROP POLICY IF EXISTS "Authenticated users full access" ON work_orders;
DROP POLICY IF EXISTS "Allow full access" ON work_orders;
CREATE POLICY "Allow full access" ON work_orders FOR ALL USING (true) WITH CHECK (true);

-- Inventory Items
DROP POLICY IF EXISTS "Authenticated users full access" ON inventory_items;
DROP POLICY IF EXISTS "Allow full access" ON inventory_items;
CREATE POLICY "Allow full access" ON inventory_items FOR ALL USING (true) WITH CHECK (true);

-- Vendors
DROP POLICY IF EXISTS "Authenticated users full access" ON vendors;
DROP POLICY IF EXISTS "Allow full access" ON vendors;
CREATE POLICY "Allow full access" ON vendors FOR ALL USING (true) WITH CHECK (true);

-- Maintenance Reports
DROP POLICY IF EXISTS "Authenticated users full access" ON maintenance_reports;
DROP POLICY IF EXISTS "Allow full access" ON maintenance_reports;
CREATE POLICY "Allow full access" ON maintenance_reports FOR ALL USING (true) WITH CHECK (true);

-- Work Requests
DROP POLICY IF EXISTS "Authenticated users full access" ON work_requests;
DROP POLICY IF EXISTS "Allow full access" ON work_requests;
CREATE POLICY "Allow full access" ON work_requests FOR ALL USING (true) WITH CHECK (true);

-- Work Permits
DROP POLICY IF EXISTS "Authenticated users full access" ON work_permits;
DROP POLICY IF EXISTS "Allow full access" ON work_permits;
CREATE POLICY "Allow full access" ON work_permits FOR ALL USING (true) WITH CHECK (true);

-- Profiles
DROP POLICY IF EXISTS "Authenticated users full access" ON profiles;
DROP POLICY IF EXISTS "Allow full access" ON profiles;
CREATE POLICY "Allow full access" ON profiles FOR ALL USING (true) WITH CHECK (true);

-- Notifications
DROP POLICY IF EXISTS "Authenticated users full access" ON notifications;
DROP POLICY IF EXISTS "Allow full access" ON notifications;
CREATE POLICY "Allow full access" ON notifications FOR ALL USING (true) WITH CHECK (true);

-- Sensor Tags
DROP POLICY IF EXISTS "Authenticated users full access" ON sensor_tags;
DROP POLICY IF EXISTS "Allow full access" ON sensor_tags;
CREATE POLICY "Allow full access" ON sensor_tags FOR ALL USING (true) WITH CHECK (true);

-- Sensor Readings
DROP POLICY IF EXISTS "Authenticated users full access" ON sensor_readings;
DROP POLICY IF EXISTS "Allow full access" ON sensor_readings;
CREATE POLICY "Allow full access" ON sensor_readings FOR ALL USING (true) WITH CHECK (true);

-- Alarm Rules
DROP POLICY IF EXISTS "Authenticated users full access" ON alarm_rules;
DROP POLICY IF EXISTS "Allow full access" ON alarm_rules;
CREATE POLICY "Allow full access" ON alarm_rules FOR ALL USING (true) WITH CHECK (true);

-- Alarm Events
DROP POLICY IF EXISTS "Authenticated users full access" ON alarm_events;
DROP POLICY IF EXISTS "Allow full access" ON alarm_events;
CREATE POLICY "Allow full access" ON alarm_events FOR ALL USING (true) WITH CHECK (true);

-- 4. Refresh PostgREST schema cache so it picks up the new column
NOTIFY pgrst, 'reload schema';

-- Done! You should see "Success. No rows returned" message.
