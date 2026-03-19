-- Migration: Add attachments support to work_requests
-- This creates a table to store photo/file attachments for work requests

create table if not exists work_request_attachments (
  id uuid default gen_random_uuid() primary key,
  work_request_id uuid not null references work_requests(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_size integer,
  file_type text,
  uploaded_by text,
  uploaded_at timestamptz default now(),
  description text,
  is_camera boolean default false
);

-- Enable Row Level Security
alter table work_request_attachments enable row level security;

-- RLS Policy: Authenticated users can view and manage attachments
drop policy if exists "Authenticated users full access" on work_request_attachments;
create policy "Authenticated users full access" on work_request_attachments
  for all
  using (true)
  with check (true);

-- Create trigger for updated_at timestamp
drop trigger if exists set_updated_at on work_request_attachments;
create trigger set_updated_at
  before update on work_request_attachments
  for each row
  execute function update_timestamp();

-- Create index for faster queries
create index if not exists idx_work_request_attachments_work_request_id 
  on work_request_attachments(work_request_id);
