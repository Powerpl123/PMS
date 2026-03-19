# Work Request Photo Attachments - Implementation Checklist

## ✅ Step-by-Step Setup Guide

### 1️⃣ **Run Database Migration** (Required)

Execute this in your Supabase SQL Editor:

```bash
Navigate to: Supabase Dashboard → SQL Editor
Copy and run: migrations/add_work_request_attachments.sql
```

This creates the `work_request_attachments` table to store photo metadata.

---

### 2️⃣ **Create Supabase Storage Bucket** (CRITICAL)

**Without this, photo uploads will fail!**

1. Go to **Supabase Dashboard** → Your Project
2. Click **Storage** (left sidebar)
3. Click **Create a new bucket**
4. Enter:
   - **Name**: `work-request-photos`
   - **Public bucket**: Toggle **ON** ✅
5. Click **Create bucket**

---

### 3️⃣ **Verify Frontend Files** (Automatic - Already Done)

✅ Components created:
- `client/src/components/PhotoAttachments.jsx` — Photo management modal
- `client/src/utils/photoCapture.js` — Upload & camera utilities

✅ Files updated:
- `client/src/api.js` — Added `workRequestAttachments` API
- `client/src/pages/WorkRequests.jsx` — Integrated photo features

✅ Documentation:
- `PHOTO_SETUP_GUIDE.md` — Detailed setup guide
- `IMPLEMENTATION_CHECKLIST.md` — This file

---

### 4️⃣ **Test the Feature**

#### In the Application:

1. Go to **Work Requests** page
2. Click on any work request
3. Look for the **Photos** column (📷 badge showing count)
4. Click the **📷 Photos** button to open the attachment modal
5. Test uploading:
   - Click **"Choose File"** → Select an image
   - Or click **"📷 Camera"** → Allow camera access → Capture photo
6. Add optional description
7. Click **"⬆️ Upload Photo"**
8. Verify photo appears in the grid below
9. Click photo to view full size
10. Test delete and verify cascade deletion

#### Expected Behavior:

| Action | Expected Result |
|--------|-----------------|
| Upload photo | Photo appears in grid with file size |
| Capture from camera | Camera app opens, photo auto-selected for upload |
| Add description | Text appears below photo thumbnail |
| Click photo | Opens full-size image in new tab |
| Delete photo | Confirms then removes from grid and storage |
| Close modal | Photo count updates in table |
| Delete work request | All photos deleted automatically |

---

### 5️⃣ **Troubleshooting**

#### ❌ "Upload failed: 404"
**Solution**: Ensure `work-request-photos` bucket exists and is public
- Check: Supabase → Storage → Bucket list
- Fix: Create bucket with exact name `work-request-photos`

#### ❌ "Camera access denied"
**Solution**: Browser permissions issue
- Mobile: Grant camera permission in browser settings
- Desktop: Check browser's camera permissions
- Chrome: Settings → Privacy → Camera

#### ❌ Photos don't show after upload
**Solution**: Check storage file access
- Verify bucket is set to "Public"
- Check file uploaded: Supabase → Storage → work-request-photos
- Check database entry: query `work_request_attachments` table

#### ❌ "Object not found" error
**Solution**: Supabase RLS policy issue
- Verify bucket RLS is set to allow public reads
- Or disable RLS for testing

---

### 6️⃣ **Feature Overview**

#### Photo Upload Features:
- ✅ Browse & select files from device
- ✅ Capture directly from device camera
- ✅ Add text descriptions to photos
- ✅ View uploaded photos in grid layout
- ✅ Click to view full-size image
- ✅ Delete with confirmation
- ✅ See file size for each photo
- ✅ Track attachment count per work request

#### Camera Support:
| Platform | Support | Notes |
|----------|---------|-------|
| Chrome/Edge Desktop | ✅ | Works with webcam |
| Chrome/Edge Mobile | ✅ | Uses rear camera |
| Firefox | ✅ | Full support |
| Safari | ✅ | iOS 14.5+ required |
| Safari Desktop | ✅ | macOS webcam |

---

### 7️⃣ **API Usage** (For Developers)

```javascript
// Import
import { uploadPhoto, deletePhoto, getPhotoUrl } from '../utils/photoCapture';
import { api } from '../api';

// Upload photo to storage and create database entry
const file = /* File object */;
const uploadResult = await uploadPhoto(file, workRequestId, false);
const attachment = await api.workRequestAttachments.create({
  workRequestId,
  filePath: uploadResult.path,
  fileName: uploadResult.fileName,
  fileSize: uploadResult.fileSize,
  fileType: uploadResult.fileType,
  description: 'Optional description',
});

// Get public URL for viewing
const url = getPhotoUrl(attachment.filePath);

// List attachments
const result = await api.workRequestAttachments.list(workRequestId);

// Delete attachment
await deletePhoto(filePath);
await api.workRequestAttachments.delete(attachmentId);
```

---

### 8️⃣ **Database Details**

#### Table: `work_request_attachments`

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `work_request_id` | UUID | Links to work_requests |
| `file_name` | TEXT | Original filename |
| `file_path` | TEXT | Path in Supabase Storage |
| `file_size` | INTEGER | Size in bytes |
| `file_type` | TEXT | MIME type (e.g., image/jpeg) |
| `uploaded_by` | TEXT | Username/email of uploader |
| `uploaded_at` | TIMESTAMP | Upload time |
| `description` | TEXT | Optional user-provided note |
| `is_camera` | BOOLEAN | True if from camera, false if uploaded |

---

### 9️⃣ **Performance Notes**

- **Attachment counts** are loaded once when page loads (fast)
- **Grid view** renders efficiently even with many photos
- **Lazy loading** optional if you add pagination
- **File size limit**: Depends on Supabase plan (typically 5GB max per file)
- **Storage quota**: Track in Supabase Dashboard → Settings → Storage

---

### 🔟 **Next Steps (Optional Enhancements)**

Future additions you might consider:
- [ ] Bulk upload multiple photos
- [ ] Photo batch tagging/organization
- [ ] Before/After photo pairs
- [ ] Photo editing (crop, rotate, annotate)
- [ ] Progress indicators for large file uploads
- [ ] Image compression before upload
- [ ] Photo timeline/sorting options
- [ ] Send photos with work permits
- [ ] Mobile app photo sync

---

## ✅ Verification Checklist

Before considering this done, verify:

- [ ] Migration SQL executed in Supabase
- [ ] `work-request-photos` bucket created and set to Public
- [ ] Can click "📷 Photos" button on work request
- [ ] Can upload file from device
- [ ] Can capture from camera
- [ ] Photo appears in grid
- [ ] Can see file info (size, name)
- [ ] Text shadow in edit modal (optional descriptions work)
- [ ] Can delete photo with confirmation
- [ ] Photo count badge updates in table view
- [ ] No console errors in browser dev tools

---

## 📞 Support

If you encounter issues:

1. **Check browser console** (F12 → Console tab)
2. **Check Supabase logs** (Dashboard → Logs)
3. **Verify network requests** (F12 → Network tab)
4. **Review PHOTO_SETUP_GUIDE.md** for detailed troubleshooting

---

## 🎉 You're All Set!

The photo attachment system is now integrated into Work Requests. Users can:
- 📷 Attach photos to track work progress
- 📱 Capture directly from device camera
- 🖼️ View and manage photo gallery
- 🗑️ Delete photos as needed

Enjoy better documentation of your work requests!
