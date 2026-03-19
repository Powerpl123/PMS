# Work Request Photo Attachments Setup Guide

This guide explains how to set up the new photo attachment functionality for work requests.

## Database Setup

### 1. Run the Migration

Execute the SQL migration to create the `work_request_attachments` table:

```sql
-- From: migrations/add_work_request_attachments.sql
```

Run this migration in your Supabase SQL editor:
- Go to Supabase Dashboard → Project → SQL Editor
- Paste the contents of `migrations/add_work_request_attachments.sql`
- Click "Run"

## Supabase Storage Setup

### 2. Create Storage Bucket

You need to create a new storage bucket for work request photos:

1. Go to **Supabase Dashboard** → Your Project → **Storage**
2. Click **Create a new bucket**
3. Configure the bucket:
   - **Name**: `work-request-photos`
   - **Public bucket**: Toggle ON (so photos can be viewed publicly)
   - Click **Create bucket**

### 3. Set up Storage RLS Policy (If Needed)

If you want to restrict bucket access:

1. In the Storage bucket settings, click the bucket name
2. Go to **Policies** tab
3. Add a policy to allow authenticated users to upload:
   ```
   CREATE POLICY "Allow authenticated users to upload"
   ON storage.objects
   FOR INSERT
   WITH CHECK (
     bucket_id = 'work-request-photos' 
     AND auth.role() = 'authenticated'
   );
   ```

## Features

### Photo Upload Options

1. **Upload from Device**
   - Click "Choose File" to select an existing photo
   - Add an optional description
   - Click "Upload Photo"

2. **Capture with Camera**
   - Click "📷 Camera" button
   - Grant camera permission when prompted
   - Photo will be automatically selected for upload

### Features Included

- ✅ Upload photos to work requests
- ✅ Capture photos directly from device camera
- ✅ View all attached photos in a grid
- ✅ Add descriptions to photos
- ✅ Delete photos with confirmation
- ✅ Track attachment counts in work request list
- ✅ Click photo to view full size
- ✅ Display file size information

## Directory Structure

### New Files Created

```
client/
  src/
    components/
      PhotoAttachments.jsx          # Photo attachment modal component
    utils/
      photoCapture.js              # Photo upload and camera utilities
  src/
    pages/
      WorkRequests.jsx             # Updated with photo functionality

migrations/
  add_work_request_attachments.sql  # Database migration
```

## API Updates

### New API Endpoints

Added `workRequestAttachments` API in `client/src/api.js`:

```javascript
api.workRequestAttachments.list(workRequestId)    // List all attachments
api.workRequestAttachments.create(body)           // Create attachment record
api.workRequestAttachments.delete(id)             // Delete attachment
api.workRequestAttachments.update(id, body)       // Update attachment
```

## Camera Access Requirements

### Browser Compatibility

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support (iOS: requires HTTPS)
- Safari: ✅ iOS 14.5+ required
- Mobile browsers: ✅ Works on Android and iOS

### Permissions

Users will see a browser permission prompt when clicking the camera button:
- Grant access to use the device camera
- Photos are captured client-side and uploaded securely

## Troubleshooting

### "Failed to upload": Check that:
1. ✅ `work-request-photos` bucket exists in Supabase Storage
2. ✅ Bucket is set to "Public"
3. ✅ User is authenticated
4. ✅ Storage in API is configured correctly

### Camera not working: Check
1. ✅ Browser has permission to access camera
2. ✅ Camera is not in use by another app
3. ✅ HTTPs is used (required for camera on some browsers)

### Photos not showing: Verify
1. ✅ File was uploaded (check Supabase Storage files)
2. ✅ Bucket is public
3. ✅ File path in database is correct

## Example Usage

```javascript
// In WorkRequests.jsx
import PhotoAttachments from '../components/PhotoAttachments';

// Open photo modal
<PhotoAttachments workRequestId={workRequest.id} onClose={handleClose} />

// Upload photo programmatically
import { uploadPhoto, getPhotoUrl } from '../utils/photoCapture';

const result = await uploadPhoto(file, workRequestId, false);
const url = getPhotoUrl(result.path);
```

## Database Schema

```sql
CREATE TABLE work_request_attachments (
  id UUID PRIMARY KEY,
  work_request_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  uploaded_by TEXT,
  uploaded_at TIMESTAMP DEFAULT NOW(),
  description TEXT,
  is_camera BOOLEAN DEFAULT FALSE
);
```

## Notes

- Photos are stored in Supabase Storage (not database)
- Metadata is stored in the database for quick retrieval
- Deleting a work request cascades to delete all attachments
- Photos can be viewed by clicking on the thumbnail
- File size limits depend on Supabase plan (typically 5GB max per file)
