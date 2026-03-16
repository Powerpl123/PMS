-- Migration: Add KKS Code field to work_requests table
-- This allows storing the plant asset's KKS code directly with each work request

ALTER TABLE work_requests
ADD COLUMN IF NOT EXISTS kks_code text;

-- Add comment for documentation
COMMENT ON COLUMN work_requests.kks_code IS 'KKS Code of the associated plant asset, copied from assets table at time of work request creation';
