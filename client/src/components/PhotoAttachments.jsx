import { useEffect, useState } from 'react';
import { api } from '../api';
import { uploadPhoto, deletePhoto, getPhotoUrl, capturePhotoFromCamera, formatFileSize } from '../utils/photoCapture';

export default function PhotoAttachments({ workRequestId, onClose }) {
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [photoDescription, setPhotoDescription] = useState('');

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  async function loadAttachments() {
    try {
      setLoading(true);
      const result = await api.workRequestAttachments.list(workRequestId, 100);
      setAttachments(result.data);
    } catch (err) {
      showToast(`Failed to load attachments: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (workRequestId) {
      loadAttachments();
    }
  }, [workRequestId]);

  async function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  }

  async function handleCameraCapture() {
    try {
      setUploading(true);
      const file = await capturePhotoFromCamera();
      setSelectedFile(file);
      setUploading(false);
    } catch (err) {
      showToast(`Camera access failed: ${err.message}`, 'error');
      setUploading(false);
    }
  }

  async function uploadAttachment() {
    if (!selectedFile) {
      showToast('Please select a file first', 'error');
      return;
    }

    try {
      setUploading(true);

      // Upload photo to Supabase storage
      const uploadResult = await uploadPhoto(selectedFile, workRequestId, false);

      // Save attachment metadata to database
      const attachment = await api.workRequestAttachments.create({
        workRequestId,
        filePath: uploadResult.path,
        fileName: uploadResult.fileName,
        fileSize: uploadResult.fileSize,
        fileType: uploadResult.fileType,
        description: photoDescription || null,
        uploadedBy: 'current_user', // You can get actual user from context
        isCamera: false,
      });

      setAttachments([attachment, ...attachments]);
      setSelectedFile(null);
      setPhotoDescription('');
      showToast('Photo uploaded successfully', 'success');
    } catch (err) {
      showToast(`Upload failed: ${err.message}`, 'error');
    } finally {
      setUploading(false);
    }
  }

  async function deleteAttachment(id, filePath) {
    if (!confirm('Delete this photo?')) return;

    try {
      setUploading(true);

      // Delete from storage
      await deletePhoto(filePath);

      // Delete from database
      await api.workRequestAttachments.delete(id);

      setAttachments(attachments.filter((a) => a.id !== id));
      showToast('Photo deleted successfully', 'success');
    } catch (err) {
      showToast(`Delete failed: ${err.message}`, 'error');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>
        <h2>📷 Photo Attachments</h2>

        {/* Upload Section */}
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#1c1c1c', border: '1px solid #383838', borderLeft: '4px solid #FFB81C' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '0.95rem', fontWeight: 600, color: '#FFFFFF' }}>Upload New Photo</h3>

          {selectedFile && (
            <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: 'rgba(0, 217, 255, 0.1)', borderRadius: 'var(--radius)', borderLeft: '4px solid #00D9FF', color: '#00D9FF' }}>
              <div style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                <strong>Selected File:</strong> {selectedFile.name}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#A0A0A0' }}>
                Size: {formatFileSize(selectedFile.size)}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', fontWeight: 500 }}>Choose File</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                disabled={uploading}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  fontSize: '0.85rem',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', fontWeight: 500 }}>&nbsp;</label>
              <button
                className="btn btn-accent"
                onClick={handleCameraCapture}
                disabled={uploading}
                style={{ width: '100%' }}
                title="Capture photo using device camera"
              >
                📷 Camera
              </button>
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', fontWeight: 500 }}>Description (Optional)</label>
            <textarea
              value={photoDescription}
              onChange={(e) => setPhotoDescription(e.target.value)}
              placeholder="e.g., Before maintenance, damage area, etc."
              rows={2}
              disabled={uploading}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                fontSize: '0.85rem',
                fontFamily: 'inherit',
              }}
            />
          </div>

          <button
            className="btn btn-primary"
            onClick={uploadAttachment}
            disabled={!selectedFile || uploading}
            style={{ width: '100%' }}
          >
            {uploading ? '⏳ Uploading...' : '⬆️ Upload Photo'}
          </button>
        </div>

        {/* Attachments List */}
        <div>
          <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '0.95rem', fontWeight: 600 }}>
            Attached Photos ({attachments.length})
          </h3>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              Loading photos...
            </div>
          ) : attachments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              No photos attached yet
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem' }}>
              {attachments.map((att) => (
                <div
                  key={att.id}
                  style={{
                    border: '1px solid #383838',
                    borderRadius: 'var(--radius)',
                    overflow: 'hidden',
                    backgroundColor: '#151515',
                  }}
                >
                  {att.filePath && (
                    <img
                      src={getPhotoUrl(att.filePath)}
                      alt={att.fileName}
                      style={{
                        width: '100%',
                        height: '120px',
                        objectFit: 'cover',
                        cursor: 'pointer',
                      }}
                      onClick={() => window.open(getPhotoUrl(att.filePath), '_blank')}
                      title="Click to view full size"
                    />
                  )}
                  <div style={{ padding: '0.5rem', fontSize: '0.75rem' }}>
                    <div style={{ fontWeight: 500, marginBottom: '0.25rem', wordBreak: 'break-word' }}>
                      {att.fileName}
                    </div>
                    {att.description && (
                      <div style={{ color: 'var(--text-muted)', marginBottom: '0.25rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {att.description}
                      </div>
                    )}
                    <div style={{ color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                      {formatFileSize(att.fileSize)}
                    </div>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => deleteAttachment(att.id, att.filePath)}
                      disabled={uploading}
                      style={{ width: '100%' }}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Close Button */}
        <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>

        {/* Toast */}
        {toast && (
          <div
            style={{
              position: 'fixed',
              bottom: '1.5rem',
              right: '1.5rem',
              padding: '.85rem 1.5rem',
              borderRadius: 'var(--radius)',
              background: toast.type === 'error' ? 'var(--danger)' : 'var(--success)',
              color: '#fff',
              fontSize: '.9rem',
              fontWeight: 600,
              boxShadow: '0 4px 20px rgba(0,0,0,.3)',
              zIndex: 200,
              maxWidth: '420px',
              animation: 'fadeIn .3s ease',
            }}
            onClick={() => setToast(null)}
          >
            {toast.type === 'error' ? '❌ ' : '✅ '}{toast.msg}
          </div>
        )}
      </div>
    </div>
  );
}
