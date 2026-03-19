import { useEffect, useState } from 'react';
import { api } from '../api';

export default function NotificationCorner() {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [lastCheck, setLastCheck] = useState(new Date());

  useEffect(() => {
    // Poll for new work request changes every 10 seconds
    const interval = setInterval(async () => {
      try {
        const workRequests = await api.workRequests.list(100).catch(() => ([]));
        const requests = Array.isArray(workRequests) ? workRequests : (workRequests.data || []);
        
        // Find recently updated items (last 30 seconds)
        const now = new Date();
        const recentRequests = requests.filter(req => {
          const updatedAt = new Date(req.updatedAt || req.createdAt);
          return (now - updatedAt) < 30000; // Last 30 seconds
        });

        if (recentRequests.length > 0) {
          recentRequests.forEach(req => {
            const message = `${req.status === 'approved' ? '✅ Approved' : req.status === 'rejected' ? '❌ Rejected' : '📋 Updated'}: ${req.title}`;
            const color = req.priority === 'critical' ? '#FF5500' : req.priority === 'high' ? '#FF8C00' : req.priority === 'medium' ? '#00D9FF' : '#A0A0A0';
            
            addNotification(message, color);
          });
        }
      } catch (error) {
        console.error('Error fetching notifications:', error);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const addNotification = (message, color = '#00D9FF') => {
    const id = Date.now();
    const notification = { id, message, color, timestamp: new Date() };
    
    setNotifications(prev => {
      const updated = [notification, ...prev];
      return updated.slice(0, 10); // Keep last 10 notifications
    });

    // Auto-remove after 8 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 8000);
  };

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  return (
    <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 9999 }}>
      {/* Floating Notification List */}
      <div style={{ marginBottom: '1rem', maxWidth: '350px' }}>
        {notifications.map(notif => (
          <div
            key={notif.id}
            style={{
              background: '#1c1c1c',
              border: `2px solid ${notif.color}`,
              borderRadius: '6px',
              padding: '0.75rem 1rem',
              marginBottom: '0.5rem',
              boxShadow: `0 4px 12px rgba(0, 0, 0, 0.4), 0 0 10px ${notif.color}33`,
              animation: 'slideIn 0.3s ease-in-out',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.85rem',
              color: '#E8E8E8',
              maxWidth: '100%'
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: '500', color: notif.color }}>{notif.message.split(':')[0]}</div>
              <div style={{ fontSize: '0.75rem', color: '#A0A0A0', marginTop: '0.2rem' }}>
                {notif.message.split(':')[1]}
              </div>
            </div>
            <button
              onClick={() => removeNotification(notif.id)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '1.2rem',
                cursor: 'pointer',
                color: '#A0A0A0',
                padding: '0',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Main Notification Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'relative',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: notifications.length > 0 ? '#FF5500' : '#FFB81C',
          border: 'none',
          color: 'white',
          fontSize: '1.5rem',
          cursor: 'pointer',
          boxShadow: notifications.length > 0 ? '0 4px 12px rgba(255, 85, 0, 0.3), 0 0 15px rgba(255, 85, 0, 0.2)' : '0 4px 12px rgba(255, 184, 28, 0.3), 0 0 15px rgba(255, 184, 28, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s ease',
          hover: {
            transform: 'scale(1.1)',
          }
        }}
        title={`${notifications.length} new notifications`}
      >
        🔔
        {notifications.length > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-5px',
              right: '-5px',
              background: '#FF5500',
              color: 'white',
              borderRadius: '50%',
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: 'bold',
              border: '2px solid white',
              boxShadow: '0 0 6px rgba(255, 85, 0, 0.4)'
            }}
          >
            {notifications.length > 9 ? '9+' : notifications.length}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            bottom: '80px',
            right: '0',
            background: '#1c1c1c',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5), 0 0 20px rgba(255, 184, 28, 0.1)',
            width: '380px',
            maxHeight: '400px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            border: '1px solid #383838'
          }}
        >
          {/* Header */}
          <div
            style={{
              background: 'linear-gradient(135deg, #004E89 0%, #1a5099 100%)',
              color: '#FFFFFF',
              padding: '1rem',
              borderBottom: '1px solid #383838',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div>
              <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>Notifications</div>
              <div style={{ fontSize: '0.8rem', opacity: 0.8, marginTop: '0.2rem' }}>
                {notifications.length} new updates
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                color: 'white',
                fontSize: '1.2rem',
                cursor: 'pointer',
                padding: '0'
              }}
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              padding: '1rem',
              maxHeight: '320px'
            }}
          >
            {notifications.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  color: '#A0A0A0',
                  padding: '2rem 1rem',
                  fontSize: '0.9rem'
                }}
              >
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✓</div>
                All caught up! No new notifications.
              </div>
            ) : (
              notifications.map(notif => (
                <div
                  key={notif.id}
                  style={{
                    padding: '0.75rem',
                    borderLeft: `4px solid ${notif.color}`,
                    marginBottom: '0.75rem',
                    background: '#151515',
                    borderRadius: '4px',
                    fontSize: '0.85rem'
                  }}
                >
                  <div style={{ fontWeight: '600', color: notif.color }}>
                    {notif.message.split(':')[0]}
                  </div>
                  <div style={{ color: '#E8E8E8', marginTop: '0.3rem' }}>
                    {notif.message.split(':')[1]}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#A0A0A0', marginTop: '0.3rem' }}>
                    {notif.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div
              style={{
                borderTop: '1px solid #383838',
                padding: '0.75rem',
                textAlign: 'center',
                background: '#151515'
              }}
            >
              <button
                onClick={clearAll}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#FF5500',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: '500',
                  transition: 'color 0.2s ease'
                }}
                onMouseEnter={e => e.target.style.color = '#FF8C00'}
                onMouseLeave={e => e.target.style.color = '#FF5500'}
              >
                Clear All
              </button>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
