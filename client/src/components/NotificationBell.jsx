import { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';

const POLL_MS = 15000;

const typeIcon = {
  assignment: '📋',
  approval: '✅',
  permit: '📄',
  alert: '⚠️',
  info: 'ℹ️',
};

export default function NotificationBell() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef();

  const profileId = profile?.id;

  const loadNotifications = useCallback(async () => {
    if (!profileId) return;
    try {
      const [items, count] = await Promise.all([
        api.notifications.list(profileId, 20),
        api.notifications.unreadCount(profileId),
      ]);
      setNotifications(items);
      setUnread(count);
    } catch { /* silently retry */ }
  }, [profileId]);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, POLL_MS);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function markRead(id) {
    try {
      await api.notifications.markRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setUnread(prev => Math.max(0, prev - 1));
    } catch { /* ignore */ }
  }

  async function markAllRead() {
    if (!profileId) return;
    try {
      await api.notifications.markAllRead(profileId);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnread(0);
    } catch { /* ignore */ }
  }

  function timeAgo(dateStr) {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  return (
    <div className="notif-bell-wrap" ref={ref}>
      <button className="notif-bell-btn" onClick={() => setOpen(o => !o)} title="Notifications">
        🔔
        {unread > 0 && <span className="notif-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-dropdown-header">
            <strong>Notifications</strong>
            {unread > 0 && (
              <button className="notif-mark-all" onClick={markAllRead}>Mark all read</button>
            )}
          </div>
          <div className="notif-dropdown-list">
            {notifications.length === 0 ? (
              <div className="notif-empty">No notifications</div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  className={`notif-item ${n.read ? '' : 'notif-unread'}`}
                  onClick={() => { if (!n.read) markRead(n.id); }}
                >
                  <span className="notif-item-icon">{typeIcon[n.type] || 'ℹ️'}</span>
                  <div className="notif-item-body">
                    <div className="notif-item-title">{n.title}</div>
                    {n.message && <div className="notif-item-msg">{n.message}</div>}
                    <div className="notif-item-time">{timeAgo(n.createdAt)}</div>
                  </div>
                  {!n.read && <span className="notif-dot" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
