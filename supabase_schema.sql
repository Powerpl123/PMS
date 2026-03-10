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
alter table inventory_items
  add constraint fk_preferred_vendor
  foreign key (preferred_vendor_id) references vendors(id) on delete set null;

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

-- 6. Row Level Security — allow authenticated users full access
alter table assets enable row level security;
alter table work_orders enable row level security;
alter table inventory_items enable row level security;
alter table vendors enable row level security;
alter table maintenance_reports enable row level security;

create policy "Authenticated users full access" on assets
  for all using (auth.role() = 'authenticated');

create policy "Authenticated users full access" on work_orders
  for all using (auth.role() = 'authenticated');

create policy "Authenticated users full access" on inventory_items
  for all using (auth.role() = 'authenticated');

create policy "Authenticated users full access" on vendors
  for all using (auth.role() = 'authenticated');

create policy "Authenticated users full access" on maintenance_reports
  for all using (auth.role() = 'authenticated');

-- 7. Auto-update updated_at trigger
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at before update on assets
  for each row execute function update_updated_at();
create trigger set_updated_at before update on work_orders
  for each row execute function update_updated_at();
create trigger set_updated_at before update on inventory_items
  for each row execute function update_updated_at();
create trigger set_updated_at before update on vendors
  for each row execute function update_updated_at();
create trigger set_updated_at before update on maintenance_reports
  for each row execute function update_updated_at();
