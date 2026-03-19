-- =====================================================
-- PMS: Fix RLS policies for anon key access
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/evaqhozshdnimhejfwzy/sql/new
-- =====================================================

-- 1. Ensure assets table schema is up to date
create table if not exists assets (
  id uuid default gen_random_uuid() primary key,
  kks_code text unique,
  name text not null,
  serial_number text,
  category text,
  location text not null,
  asset_type text check (asset_type in ('PRODUCTION','TOOL')),
  model_type text,
  status text not null default 'active'
    check (status in ('active','maintenance','retired','inactive')),
  purchase_date timestamptz,
  install_date timestamptz,
  useful_life_years int default 0,
  purchase_cost numeric default 0,
  current_value numeric default 0,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Enable RLS
alter table assets enable row level security;

-- 3. Drop old restrictive policies
drop policy if exists "Authenticated users full access" on assets;
drop policy if exists "Anon users full access" on assets;

-- 4. Add policy that allows BOTH anon and authenticated roles
create policy "Allow all access" on assets
  for all using (true) with check (true);

-- 5. Do the same for ALL other tables so the whole app works

-- work_orders
alter table work_orders enable row level security;
drop policy if exists "Authenticated users full access" on work_orders;
drop policy if exists "Allow all access" on work_orders;
create policy "Allow all access" on work_orders
  for all using (true) with check (true);

-- inventory_items
alter table inventory_items enable row level security;
drop policy if exists "Authenticated users full access" on inventory_items;
drop policy if exists "Allow all access" on inventory_items;
create policy "Allow all access" on inventory_items
  for all using (true) with check (true);

-- vendors
alter table vendors enable row level security;
drop policy if exists "Authenticated users full access" on vendors;
drop policy if exists "Allow all access" on vendors;
create policy "Allow all access" on vendors
  for all using (true) with check (true);

-- maintenance_reports
alter table maintenance_reports enable row level security;
drop policy if exists "Authenticated users full access" on maintenance_reports;
drop policy if exists "Allow all access" on maintenance_reports;
create policy "Allow all access" on maintenance_reports
  for all using (true) with check (true);

-- work_requests
alter table work_requests enable row level security;
drop policy if exists "Authenticated users full access" on work_requests;
drop policy if exists "Allow all access" on work_requests;
create policy "Allow all access" on work_requests
  for all using (true) with check (true);

-- work_permits
alter table work_permits enable row level security;
drop policy if exists "Authenticated users full access" on work_permits;
drop policy if exists "Allow all access" on work_permits;
create policy "Allow all access" on work_permits
  for all using (true) with check (true);

-- profiles
alter table profiles enable row level security;
drop policy if exists "Authenticated users full access" on profiles;
drop policy if exists "Allow all access" on profiles;
create policy "Allow all access" on profiles
  for all using (true) with check (true);

-- notifications
alter table notifications enable row level security;
drop policy if exists "Authenticated users full access" on notifications;
drop policy if exists "Allow all access" on notifications;
create policy "Allow all access" on notifications
  for all using (true) with check (true);

-- sensor_tags
alter table sensor_tags enable row level security;
drop policy if exists "Authenticated users full access" on sensor_tags;
drop policy if exists "Allow all access" on sensor_tags;
create policy "Allow all access" on sensor_tags
  for all using (true) with check (true);

-- sensor_readings
alter table sensor_readings enable row level security;
drop policy if exists "Authenticated users full access" on sensor_readings;
drop policy if exists "Allow all access" on sensor_readings;
create policy "Allow all access" on sensor_readings
  for all using (true) with check (true);

-- alarm_rules
alter table alarm_rules enable row level security;
drop policy if exists "Authenticated users full access" on alarm_rules;
drop policy if exists "Allow all access" on alarm_rules;
create policy "Allow all access" on alarm_rules
  for all using (true) with check (true);

-- alarm_events
alter table alarm_events enable row level security;
drop policy if exists "Authenticated users full access" on alarm_events;
drop policy if exists "Allow all access" on alarm_events;
create policy "Allow all access" on alarm_events
  for all using (true) with check (true);

-- generation_units
alter table generation_units enable row level security;
drop policy if exists "Authenticated users full access" on generation_units;
drop policy if exists "Allow all access" on generation_units;
create policy "Allow all access" on generation_units
  for all using (true) with check (true);

-- =====================================================
-- Done! All tables now allow the anon key to read/write
-- You can now run: node scripts/insert_assets_supabase.mjs
-- =====================================================
