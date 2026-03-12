-- ============================================
-- PMS Supabase Schema
-- Run this in your Supabase SQL Editor
-- (Dashboard → SQL Editor → New Query)
-- ============================================

-- 1. Assets
create table if not exists assets (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  serial_number text unique,
  category text not null,
  location text not null,
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

-- 2. Work Orders
create table if not exists work_orders (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  asset_id uuid references assets(id) on delete set null,
  assigned_to text,
  priority text not null default 'medium'
    check (priority in ('low','medium','high','critical')),
  status text not null default 'open'
    check (status in ('open','in-progress','completed','cancelled')),
  due_date timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  labor_hours numeric default 0,
  estimated_cost numeric default 0,
  actual_cost numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Inventory Items
create table if not exists inventory_items (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  sku text not null unique,
  description text,
  unit_cost numeric default 0,
  quantity_in_stock int default 0,
  reorder_point int default 0,
  preferred_vendor_id uuid,
  location text,
  unit text default 'pcs',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 4. Vendors
create table if not exists vendors (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  contact_name text,
  email text,
  phone text,
  address text,
  rating numeric default 0 check (rating >= 0 and rating <= 5),
  service_agreements text[],
  performance_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Add FK on inventory after vendors exists
do $$ begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'fk_preferred_vendor'
      and table_name = 'inventory_items'
  ) then
    alter table inventory_items
      add constraint fk_preferred_vendor
      foreign key (preferred_vendor_id) references vendors(id) on delete set null;
  end if;
end $$;

-- 5. Maintenance Reports
create table if not exists maintenance_reports (
  id uuid default gen_random_uuid() primary key,
  report_date timestamptz default now(),
  period_start timestamptz not null,
  period_end timestamptz not null,
  total_work_orders int default 0,
  completed_work_orders int default 0,
  total_labor_hours numeric default 0,
  downtime_hours numeric default 0,
  total_maintenance_cost numeric default 0,
  compliance_notes text,
  generated_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 6. Work Requests
create table if not exists work_requests (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  asset_id uuid references assets(id) on delete set null,
  requested_by text,
  assigned_to_name text,
  assigned_to_email text,
  department text,
  work_type text not null default 'corrective'
    check (work_type in ('corrective','preventive','inspection','emergency')),
  priority text not null default 'medium'
    check (priority in ('low','medium','high','critical')),
  status text not null default 'pending'
    check (status in ('pending','approved','in-progress','completed','rejected','cancelled')),
  location text,
  scheduled_date timestamptz,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 7. Work Permits
create table if not exists work_permits (
  id uuid default gen_random_uuid() primary key,
  work_request_id uuid references work_requests(id) on delete cascade,
  permit_number text not null unique,
  issued_by text,
  issued_to text,
  work_description text,
  location text,
  start_date timestamptz,
  end_date timestamptz,
  safety_precautions text,
  ppe_required text[] default '{}',
  hazards text,
  status text not null default 'issued'
    check (status in ('issued','active','closed','revoked')),
  approved_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 8. Row Level Security — allow authenticated users full access
alter table assets enable row level security;
alter table work_orders enable row level security;
alter table inventory_items enable row level security;
alter table vendors enable row level security;
alter table maintenance_reports enable row level security;
alter table work_requests enable row level security;
alter table work_permits enable row level security;

drop policy if exists "Authenticated users full access" on assets;
create policy "Authenticated users full access" on assets
  for all using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users full access" on work_orders;
create policy "Authenticated users full access" on work_orders
  for all using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users full access" on inventory_items;
create policy "Authenticated users full access" on inventory_items
  for all using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users full access" on vendors;
create policy "Authenticated users full access" on vendors
  for all using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users full access" on maintenance_reports;
create policy "Authenticated users full access" on maintenance_reports
  for all using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users full access" on work_requests;
create policy "Authenticated users full access" on work_requests
  for all using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users full access" on work_permits;
create policy "Authenticated users full access" on work_permits
  for all using (auth.role() = 'authenticated');

-- 7. Auto-update updated_at trigger
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_updated_at on assets;
create trigger set_updated_at before update on assets
  for each row execute function update_updated_at();
drop trigger if exists set_updated_at on work_orders;
create trigger set_updated_at before update on work_orders
  for each row execute function update_updated_at();
drop trigger if exists set_updated_at on inventory_items;
create trigger set_updated_at before update on inventory_items
  for each row execute function update_updated_at();
drop trigger if exists set_updated_at on vendors;
create trigger set_updated_at before update on vendors
  for each row execute function update_updated_at();
drop trigger if exists set_updated_at on maintenance_reports;
create trigger set_updated_at before update on maintenance_reports
  for each row execute function update_updated_at();
drop trigger if exists set_updated_at on work_requests;
create trigger set_updated_at before update on work_requests
  for each row execute function update_updated_at();
drop trigger if exists set_updated_at on work_permits;
create trigger set_updated_at before update on work_permits
  for each row execute function update_updated_at();

-- 8. User Profiles (standalone — no FK to auth.users so users can be added before they sign up)
create table if not exists profiles (
  id uuid default gen_random_uuid() primary key,
  full_name text not null,
  email text not null unique,
  role text not null default 'technician'
    check (role in ('admin','manager','technician','operator','viewer')),
  department text,
  phone text,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table profiles enable row level security;
drop policy if exists "Authenticated users full access" on profiles;
create policy "Authenticated users full access" on profiles
  for all using (auth.role() = 'authenticated');
drop trigger if exists set_updated_at on profiles;
create trigger set_updated_at before update on profiles
  for each row execute function update_updated_at();

-- 9. In-App Notifications
create table if not exists notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  message text,
  type text not null default 'info'
    check (type in ('info','assignment','approval','permit','alert')),
  link text,
  read boolean default false,
  created_at timestamptz default now()
);

alter table notifications enable row level security;
drop policy if exists "Authenticated users full access" on notifications;
create policy "Authenticated users full access" on notifications
  for all using (auth.role() = 'authenticated');

-- ============================================
-- 10. Sensor Tags — DCS tag → asset mapping
-- ============================================
create table if not exists sensor_tags (
  id uuid default gen_random_uuid() primary key,
  asset_id uuid references assets(id) on delete set null,
  tag_name text not null unique,
  parameter text not null
    check (parameter in (
      'load','steam_temp','steam_pressure','cond_vacuum',
      'vibration','bearing_temp','exhaust_temp','frequency',
      'drum_level','flue_gas_temp','feed_water_temp','cw_inlet_temp','cw_outlet_temp',
      'voltage','current','power_factor','speed',
      'fuel_flow','air_flow','o2_level','co_level',
      'other'
    )),
  unit text not null default '—',
  min_range numeric default 0,
  max_range numeric default 100,
  warn_low numeric,
  warn_high numeric,
  crit_low numeric,
  crit_high numeric,
  description text,
  protocol text default 'opc-ua' check (protocol in ('opc-ua','modbus','csv')),
  address text,
  generation_unit int,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table sensor_tags enable row level security;
drop policy if exists "Authenticated users full access" on sensor_tags;
create policy "Authenticated users full access" on sensor_tags
  for all using (auth.role() = 'authenticated');
drop trigger if exists set_updated_at on sensor_tags;
create trigger set_updated_at before update on sensor_tags
  for each row execute function update_updated_at();

-- ============================================
-- 11. Sensor Readings — time-series data
-- ============================================
create table if not exists sensor_readings (
  id uuid default gen_random_uuid() primary key,
  tag_id uuid not null references sensor_tags(id) on delete cascade,
  value numeric not null,
  quality text not null default 'good'
    check (quality in ('good','bad','uncertain')),
  timestamp timestamptz not null default now()
);

create index if not exists idx_readings_tag_ts
  on sensor_readings (tag_id, timestamp desc);
create index if not exists idx_readings_ts
  on sensor_readings (timestamp desc);

alter table sensor_readings enable row level security;
drop policy if exists "Authenticated users full access" on sensor_readings;
create policy "Authenticated users full access" on sensor_readings
  for all using (auth.role() = 'authenticated');

-- Enable Supabase Realtime on sensor_readings
do $$ begin
  alter publication supabase_realtime add table sensor_readings;
exception when duplicate_object then null;
end $$;

-- ============================================
-- 12. Alarm Rules — threshold definitions
-- ============================================
create table if not exists alarm_rules (
  id uuid default gen_random_uuid() primary key,
  tag_id uuid not null references sensor_tags(id) on delete cascade,
  condition text not null default '>'
    check (condition in ('>','<','>=','<=','==')),
  threshold numeric not null,
  severity text not null default 'warning'
    check (severity in ('warning','critical')),
  message_template text,
  auto_create_wo boolean default false,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table alarm_rules enable row level security;
drop policy if exists "Authenticated users full access" on alarm_rules;
create policy "Authenticated users full access" on alarm_rules
  for all using (auth.role() = 'authenticated');
drop trigger if exists set_updated_at on alarm_rules;
create trigger set_updated_at before update on alarm_rules
  for each row execute function update_updated_at();

-- ============================================
-- 13. Alarm Events — triggered alarm history
-- ============================================
create table if not exists alarm_events (
  id uuid default gen_random_uuid() primary key,
  rule_id uuid references alarm_rules(id) on delete set null,
  tag_id uuid not null references sensor_tags(id) on delete cascade,
  value numeric not null,
  severity text not null default 'warning'
    check (severity in ('warning','critical')),
  message text,
  acknowledged boolean default false,
  acknowledged_by text,
  triggered_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_alarm_events_unresolved
  on alarm_events (triggered_at desc) where resolved_at is null;

alter table alarm_events enable row level security;
drop policy if exists "Authenticated users full access" on alarm_events;
create policy "Authenticated users full access" on alarm_events
  for all using (auth.role() = 'authenticated');

-- Enable Supabase Realtime on alarm_events
do $$ begin
  alter publication supabase_realtime add table alarm_events;
exception when duplicate_object then null;
end $$;

-- ============================================
-- 14. Generation Units — persisted unit config
-- ============================================
create table if not exists generation_units (
  id uuid default gen_random_uuid() primary key,
  unit_number int not null unique,
  name text not null,
  capacity_mw numeric not null default 35,
  online boolean default true,
  load_setpoint_mw numeric default 0,
  fuel_type text default 'peat',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table generation_units enable row level security;
drop policy if exists "Authenticated users full access" on generation_units;
create policy "Authenticated users full access" on generation_units
  for all using (auth.role() = 'authenticated');
drop trigger if exists set_updated_at on generation_units;
create trigger set_updated_at before update on generation_units
  for each row execute function update_updated_at();

-- Seed default generation units
insert into generation_units (unit_number, name, capacity_mw, online, load_setpoint_mw)
values
  (1, 'Unit 1', 35, true, 35),
  (2, 'Unit 2', 35, true, 35)
on conflict (unit_number) do nothing;
