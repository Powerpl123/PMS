-- Migration: Add approval tracking to work_requests
-- This adds fields to track who approved a work request and when

ALTER TABLE work_requests
ADD COLUMN IF NOT EXISTS approved_by text,
ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- Comment on new columns
COMMENT ON COLUMN work_requests.approved_by IS 'Name or email of the manager/admin who approved the work request';
COMMENT ON COLUMN work_requests.approved_at IS 'Timestamp when the work request was approved';

-- Create an index for faster approval queries
CREATE INDEX IF NOT EXISTS idx_work_requests_approved_at 
  ON work_requests(approved_at DESC);
