import { supabase } from '../supabaseClient';

/**
 * Upload a file (photo) to Supabase storage
 * @param {File} file - The file to upload
 * @param {string} workRequestId - The work request ID
 * @param {boolean} isCamera - Whether the photo was taken from camera
 * @returns {Promise<{path: string, fileName: string, fileSize: number, fileType: string}>}
 */
export async function uploadPhoto(file, workRequestId, isCamera = false) {
  if (!file) throw new Error('No file provided');
  if (!workRequestId) throw new Error('No work request ID provided');

  // Create a unique file name
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(7);
  const extension = file.name.split('.').pop() || 'jpg';
  const fileName = `${workRequestId}/${isCamera ? 'camera' : 'upload'}_${timestamp}_${randomStr}.${extension}`;

  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from('work-request-photos')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  return {
    path: data.path,
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
  };
}

/**
 * Delete a photo from Supabase storage
 * @param {string} filePath - The file path in storage
 */
export async function deletePhoto(filePath) {
  if (!filePath) throw new Error('No file path provided');

  const { error } = await supabase.storage
    .from('work-request-photos')
    .remove([filePath]);

  if (error) throw new Error(`Delete failed: ${error.message}`);
}

/**
 * Get a public URL for a photo
 * @param {string} filePath - The file path in storage
 * @returns {string} The public URL
 */
export function getPhotoUrl(filePath) {
  if (!filePath) return null;

  const { data } = supabase.storage
    .from('work-request-photos')
    .getPublicUrl(filePath);

  return data?.publicUrl || null;
}

/**
 * Capture photo from device camera
 * @returns {Promise<File>} The captured photo as a File object
 */
export async function capturePhotoFromCamera() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment'; // Use rear camera on mobile, fallback to file picker

    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (file) {
        resolve(file);
      } else {
        reject(new Error('No file selected'));
      }
    };

    input.onerror = () => {
      reject(new Error('Camera access denied or not available'));
    };

    input.click();
  });
}

/**
 * Convert canvas to blob for video stream capture
 * @param {HTMLCanvasElement} canvas
 * @returns {Promise<Blob>}
 */
export function canvasToBlob(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', 0.9);
  });
}

/**
 * Format file size for display
 * @param {number} bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
