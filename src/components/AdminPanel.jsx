import { useState, useEffect, useCallback, useMemo } from 'react';

import {
  Shield, LogOut, Users, Search, Ban, Trash2, CheckCircle,
  XCircle, RefreshCw, Eye, EyeOff, AlertTriangle,
  Activity, UserCheck, UserX, Clock, ChevronDown, ChevronUp,
  Laptop, Smartphone, Network, Play, Pause, Radio, Zap, Key, Sparkles
} from 'lucide-react';
import TunelyLogo from './TunelyLogo';

const API_BASE = (import.meta.env.VITE_API_BASE || 'https://jiosaavn-api.adityapatil2348.workers.dev').trim();

// ─── Admin credentials are verified server-side only ──────────────────────────
const ADMIN_TOKEN_KEY = 'tunely_admin_token';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const decodeHtml = (text) => {
  if (!text) return '';
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&apos;/g, "'");
};

const fmtDate = (iso) => {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

const formatTimeAgo = (iso) => {
  if (!iso) return 'Never active';
  const time = new Date(iso).getTime();
  if (isNaN(time)) return 'Never active';
  const diffSecs = Math.floor((Date.now() - time) / 1000);
  
  if (diffSecs < 120) return '🟢 Active Now';
  if (diffSecs < 3600) return `Active ${Math.floor(diffSecs / 60)}m ago`;
  if (diffSecs < 86400) return `Active ${Math.floor(diffSecs / 3600)}h ago`;
  if (diffSecs < 604800) return `Active ${Math.floor(diffSecs / 86400)}d ago`;
  
  return fmtDate(iso);
};

const formatDuration = (secs) => {
  if (!secs) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const avatarColor = (str = '') => {
  const colors = [
    'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
    'linear-gradient(135deg, #ff0844 0%, #ffb199 100%)',
    'linear-gradient(135deg, #b18cfb 0%, #7c3aed 100%)',
    'linear-gradient(135deg, #453a94 0%, #f43f5e 100%)',
    'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
    'linear-gradient(135deg, #f857a6 0%, #ff5858 100%)',
  ];
  let hash = 0;
  for (const c of str) hash = c.charCodeAt(0) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

// ─── Stat Card Component ──────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color, glowColor, sub }) {
  return (
    <div className="stat-card" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Decorative Glow Spot */}
      <div style={{
        position: 'absolute', right: -20, top: -20, width: 80, height: 80,
        borderRadius: '50%', background: glowColor, filter: 'blur(35px)', opacity: 0.15, pointerEvents: 'none'
      }} />

      <div className="stat-card-header">
        <span className="stat-card-label">{label}</span>
        <div className="stat-card-icon-container" style={{ background: color, boxShadow: `0 4px 15px ${glowColor}40` }}>
          <Icon size={18} color="#fff" />
        </div>
      </div>

      <div className="stat-card-body">
        <div className="stat-card-value">{value}</div>
        {sub && <div className="stat-card-sub">{sub}</div>}
      </div>
    </div>
  );
}

// ─── Active User Live Card (Online Sessions) ──────────────────────────────────
function ActiveUserCard({ session, onBan, onUnban, onDelete, onViewDetails }) {
  const user = session;
  const activity = session.activity;
  const initial = (user.name || user.email || 'U').charAt(0).toUpperCase();

  const isBanned = user.banned;
  const isPlaying = activity?.isPlaying;
  const track = activity?.track;

  const isMobile = activity?.device?.toLowerCase().includes('mobile') || activity?.device?.toLowerCase().includes('phone') || activity?.device?.toLowerCase().includes('android') || activity?.device?.toLowerCase().includes('ios');

  return (
    <div className="active-user-card">
      {/* Waveform Sound Wave animation when playing */}
      {isPlaying && (
        <div style={{ position: 'absolute', top: 20, right: 24, display: 'flex', alignItems: 'flex-end', gap: 2, height: 16 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="soundwave-bar" style={{
              width: 3, background: '#00e5ff', borderRadius: 2,
              animation: `soundwave 0.8s ease-in-out infinite alternate`,
              animationDelay: `${i * 0.15}s`
            }} />
          ))}
        </div>
      )}

      {/* User Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: avatarColor(user.email), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
          {initial}
        </div>
        <div style={{ overflow: 'hidden', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name || 'Unnamed'}</span>
            <span style={{
              width: 7, height: 7, borderRadius: '50%', background: '#10b981',
              boxShadow: '0 0 10px #10b981', display: 'inline-block', flexShrink: 0
            }} />
          </div>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</span>
        </div>
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', margin: '2px 0' }}></div>

      {/* Playback Activity Display */}
      {track ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Now Playing</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)', overflow: 'hidden' }}>
            <img
              src={track.image?.[1]?.url || track.image?.[0]?.url || '/logo.png'}
              alt=""
              style={{ width: 38, height: 38, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}
            />
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 12, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{decodeHtml(track.name)}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.artists?.primary?.[0]?.name || 'Unknown Artist'}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', background: isPlaying ? 'rgba(0, 229, 255, 0.12)' : 'rgba(255,255,255,0.06)', color: isPlaying ? '#00e5ff' : 'rgba(255,255,255,0.4)', flexShrink: 0 }}>
              {isPlaying ? <Play size={10} fill="currentColor" /> : <Pause size={10} />}
            </div>
          </div>

          {/* Activity Progress Bar */}
          {isPlaying && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>
                <span>{formatDuration(activity.progress)}</span>
                <span>Live Feed</span>
              </div>
              <div style={{ height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', background: 'linear-gradient(90deg, #00f2fe, #4facfe)',
                  width: `${Math.min(100, Math.max(10, ((activity.progress % 200) / 200) * 100))}%`,
                  transition: 'width 1s ease'
                }}></div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.3)', fontSize: 11, padding: '12px 0', justifyContent: 'center', border: '1px dashed rgba(255,255,255,0.05)', borderRadius: 12 }}>
          <Radio size={12} />
          <span>Active, but currently idle</span>
        </div>
      )}

      {/* Metadata */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 10, color: 'rgba(255,255,255,0.35)', background: 'rgba(0,0,0,0.15)', padding: 10, borderRadius: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
            {isMobile ? <Smartphone size={10} style={{ flexShrink: 0 }} /> : <Laptop size={10} style={{ flexShrink: 0 }} />}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activity?.device || 'Desktop Browser'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <Network size={10} />
            <span>{activity?.ip || '127.0.0.1'}</span>
          </div>
        </div>
        <div style={{ fontSize: 9, color: 'rgba(0, 229, 255, 0.45)', textAlign: 'right', marginTop: 2 }}>
          Last seen: {fmtDate(activity?.lastActive || user.lastSeen)}
        </div>
      </div>

      {/* Row Control Actions */}
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <button onClick={() => onViewDetails(user)} style={{ flex: 1, padding: '7px 0', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontWeight: 500 }}>
          <Eye size={11} /> Details
        </button>
        {isBanned ? (
          <button onClick={() => onUnban(user)} style={{ flex: 1, padding: '7px 0', borderRadius: 8, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)', color: '#34d399', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontWeight: 500 }}>
            <UserCheck size={11} /> Unban
          </button>
        ) : (
          <button onClick={() => onBan(user)} style={{ flex: 1, padding: '7px 0', borderRadius: 8, background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)', color: '#fbbf24', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontWeight: 500 }}>
            <Ban size={11} /> Ban
          </button>
        )}
        <button onClick={() => onDelete(user)} style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', color: '#f87171', cursor: 'pointer', flexShrink: 0 }}>
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}

// ─── Standard User Row (desktop grid / mobile card) ──────────────────────────
function UserRow({ user, onBan, onUnban, onDelete, onResetPassword, onViewDetails }) {
  const initial = (user.name || user.email || 'U').charAt(0).toUpperCase();
  const isBanned = user.banned;
  const isOnline = !!user.activity;

  return (
    <>
      {/* ── DESKTOP ROW (hidden on mobile) ── */}
      <div className="user-row-desktop" style={{ background: isBanned ? 'rgba(239,68,68,0.02)' : 'transparent' }}>
        <div style={{ position: 'relative' }}>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: avatarColor(user.email), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#fff' }}>
            {initial}
          </div>
          <span className={`online-dot-indicator ${isOnline ? 'online' : 'offline'}`} />
        </div>

        <div style={{ overflow: 'hidden' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name || 'Unnamed'}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</div>
        </div>

        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{fmtDate(user.createdAt).split(',')[0]}</div>

        <div>
          <span className={`status-badge-inline ${isBanned ? 'banned' : 'active'}`}>
            {isBanned ? <XCircle size={10} /> : <CheckCircle size={10} />}
            {isBanned ? 'Banned' : 'Active'}
          </span>
        </div>

        <div style={{ fontSize: 12, color: isOnline ? '#00e5ff' : 'rgba(255,255,255,0.6)', fontWeight: isOnline ? 600 : 500 }} title={`Exact last active: ${fmtDate(user.lastSeen || user.activity?.lastActive || user.createdAt)}`}>
          {isOnline ? '🟢 Active Now' : formatTimeAgo(user.lastSeen || user.activity?.lastActive || user.createdAt)}
        </div>

        <div className="user-row-actions">
          <button onClick={() => onViewDetails(user)} className="action-btn text-btn"><Eye size={12} /> Details</button>
          <button onClick={() => onResetPassword(user)} className="action-btn secondary-btn" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} title="Reset Password"><Key size={12} /> Reset</button>
          {isBanned
            ? <button onClick={() => onUnban(user)} className="action-btn success-btn"><UserCheck size={12} /> Unban</button>
            : <button onClick={() => onBan(user)} className="action-btn warning-btn"><Ban size={12} /> Ban</button>}
          <button onClick={() => onDelete(user)} className="action-btn danger-btn-icon"><Trash2 size={12} /></button>
        </div>
      </div>

      {/* ── MOBILE CARD (hidden on desktop) ── */}
      <div className="user-row-mobile-card" style={{ background: isBanned ? 'rgba(239,68,68,0.03)' : 'rgba(255,255,255,0.01)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        {/* Top: Avatar + Name + Email + Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ width: 42, height: 42, borderRadius: '50%', background: avatarColor(user.email), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#fff' }}>
              {initial}
            </div>
            <span className={`online-dot-indicator ${isOnline ? 'online' : 'offline'}`} />
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name || 'Unnamed'}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
          </div>
          <span className={`status-badge-inline ${isBanned ? 'banned' : 'active'}`} style={{ flexShrink: 0 }}>
            {isBanned ? <XCircle size={10} /> : <CheckCircle size={10} />}
            {isBanned ? 'Banned' : 'Active'}
          </span>
        </div>

        {/* Info rows: Joined + Last Seen */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 10px' }}>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>Joined</div>
            <div style={{ fontSize: 12, color: '#fff', fontWeight: 500 }}>{fmtDate(user.createdAt).split(',')[0]}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 10px' }}>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>Last Active</div>
            <div style={{ fontSize: 11, color: isOnline ? '#00e5ff' : '#00e5ff', fontWeight: isOnline ? 700 : 600 }} title={`Exact last active: ${fmtDate(user.lastSeen || user.activity?.lastActive || user.createdAt)}`}>
              {isOnline ? '🟢 Active Now' : formatTimeAgo(user.lastSeen || user.activity?.lastActive || user.createdAt)}
            </div>
          </div>
        </div>

        {/* Action Buttons: full width row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <button onClick={() => onViewDetails(user)} className="action-btn text-btn" style={{ flex: '1 1 45%', justifyContent: 'center' }}>
            <Eye size={12} /> Details
          </button>
          <button onClick={() => onResetPassword(user)} className="action-btn secondary-btn" style={{ flex: '1 1 45%', justifyContent: 'center', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}>
            <Key size={12} /> Reset
          </button>
          {isBanned
            ? <button onClick={() => onUnban(user)} className="action-btn success-btn" style={{ flex: '1 1 45%', justifyContent: 'center' }}>
                <UserCheck size={12} /> Unban
              </button>
            : <button onClick={() => onBan(user)} className="action-btn warning-btn" style={{ flex: '1 1 45%', justifyContent: 'center' }}>
                <Ban size={12} /> Ban
              </button>}
          <button onClick={() => onDelete(user)} className="action-btn danger-btn-icon" style={{ flex: '1 1 45%', justifyContent: 'center', gap: 4 }}>
            <Trash2 size={12} /> Delete
          </button>
        </div>
      </div>
    </>
  );
}

// ─── User Detail Modal ────────────────────────────────────────────────────────
function UserDetailModal({ user, onClose, onBan, onUnban, onDelete, onResetPassword }) {
  const [copied, setCopied] = useState(false);
  if (!user) return null;
  const isBanned = user.banned;
  const isOnline = !!user.activity;
  const activity = user.activity;


  const copyEmail = () => {
    navigator.clipboard.writeText(user.email).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Fallback for browsers without clipboard API
      const el = document.createElement('textarea');
      el.value = user.email;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}><Shield size={18} color="#00e5ff" /> User Inspector</h2>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '50%', width: 28, height: 28, color: 'rgba(255,255,255,0.6)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>✕</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 50, height: 50, borderRadius: '50%', background: avatarColor(user.email), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900, color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.4)', flexShrink: 0 }}>
            {(user.name || user.email || 'U').charAt(0).toUpperCase()}
          </div>
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name || 'Unnamed'}</span>
              {isOnline && <span style={{ padding: '2px 6px', borderRadius: 8, background: 'rgba(16,185,129,0.15)', color: '#34d399', fontSize: 9, fontWeight: 750 }}>ONLINE</span>}
              {isBanned && <span style={{ padding: '2px 6px', borderRadius: 8, background: 'rgba(239,68,68,0.15)', color: '#f87171', fontSize: 9, fontWeight: 750 }}>BANNED</span>}
            </div>
            {/* Copyable email row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 500, fontFamily: 'monospace' }}>{user.email}</span>
              <button
                onClick={copyEmail}
                title="Copy email"
                style={{ background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)', border: `1px solid ${copied ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 6, padding: '2px 8px', color: copied ? '#4ade80' : 'rgba(255,255,255,0.5)', fontSize: 10, cursor: 'pointer', transition: 'all 0.2s', fontWeight: 600 }}
              >
                {copied ? '✓ Copied' : '📋 Copy'}
              </button>
            </div>
          </div>
        </div>

        {/* Live track view */}
        {isOnline && activity?.track && (
          <div style={{ background: 'rgba(0, 229, 255, 0.04)', border: '1px solid rgba(0, 229, 255, 0.15)', borderRadius: 14, padding: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#00e5ff', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Listening To:</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <img src={activity.track.image?.[1]?.url || activity.track.image?.[0]?.url} alt="" style={{ width: 36, height: 36, borderRadius: 6, flexShrink: 0 }} />
              <div style={{ overflow: 'hidden', flex: 1 }}>
                <div style={{ color: '#fff', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{decodeHtml(activity.track.name)}</div>
                <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activity.track.artists?.primary?.[0]?.name}</div>
              </div>
            </div>
            {activity.device && (
              <div style={{ marginTop: 8, fontSize: 10, color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', gap: 4 }}>
                🎧 Playing on: <strong style={{ color: 'rgba(255,255,255,0.6)' }}>{activity.device}</strong>
              </div>
            )}
          </div>
        )}

        <div className="inspector-fields-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {[
            ['User ID', user.id],
            ['Status', isBanned ? '🚫 Banned' : '✅ Active'],
            ['Email', user.email],
            ['Joined', fmtDate(user.createdAt)],
            ['Last Active', isOnline ? '🟢 Active Now' : `${formatTimeAgo(user.lastSeen || user.activity?.lastActive || user.createdAt)} (${fmtDate(user.lastSeen || user.activity?.lastActive || user.createdAt)})`],
            ['Device', activity?.device || 'Offline'],
            ['Password', '🔒 PBKDF2 Hashed (use Reset to set)'],
          ].map(([label, val]) => (
            <div key={label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 12, color: '#fff', fontWeight: 500, wordBreak: 'break-all' }}>{val || '—'}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <button onClick={() => { onResetPassword(user); onClose(); }} className="modal-action-btn secondary" style={{ flex: '1 1 auto', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <Key size={14} /> Set Password
          </button>
          {isBanned ? (
            <button onClick={() => { onUnban(user); onClose(); }} className="modal-action-btn success" style={{ flex: '1 1 auto' }}>
              <UserCheck size={14} /> Unban Account
            </button>
          ) : (
            <button onClick={() => { onBan(user); onClose(); }} className="modal-action-btn warning" style={{ flex: '1 1 auto' }}>
              <Ban size={14} /> Ban Account
            </button>
          )}
          <button onClick={() => { if (confirm(`Permanently delete ${user.name || user.email}?`)) { onDelete(user); onClose(); } }} className="modal-action-btn danger" style={{ flex: '1 1 auto' }}>
            <Trash2 size={14} /> Delete User
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Admin Login Component ───────────────────────────────────────────────────
function AdminLogin({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      });
      const data = await res.json();
      if (res.ok && data.token) {
        sessionStorage.setItem(ADMIN_TOKEN_KEY, data.token);
        onLogin(data.token);
      } else {
        setError(data.message || 'Invalid credentials. Access denied.');
      }
    } catch {
      setError('Network error. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(circle at 50% 0%, rgba(0, 229, 255, 0.1) 0%, #05060a 60%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Outfit', 'Inter', sans-serif" }}>
      <div className="login-card">
        
        {/* Logo Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <div style={{ width: 60, height: 60, borderRadius: 18, background: 'linear-gradient(135deg, #00f2fe, #4facfe)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 25px rgba(0, 242, 254, 0.3)' }}>
            <Shield size={28} color="#fff" />
          </div>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', margin: 0 }}>Tunely Admin Control</h1>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: '4px 0 0' }}>Super Admin Authorization Portal</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: 6, display: 'block', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Super Admin Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)} required
              placeholder="aditya@admin.com"
              style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s, background-color 0.2s' }}
              onFocus={e => { e.target.style.borderColor = 'rgba(0, 229, 255, 0.5)'; e.target.style.backgroundColor = 'rgba(255,255,255,0.05)'; }}
              onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.backgroundColor = 'rgba(255,255,255,0.03)'; }}
            />
          </div>
          <div>
            <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: 6, display: 'block', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Secure Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                placeholder="••••••••••••"
                style={{ width: '100%', padding: '12px 42px 12px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s, background-color 0.2s' }}
                onFocus={e => { e.target.style.borderColor = 'rgba(0, 229, 255, 0.5)'; e.target.style.backgroundColor = 'rgba(255,255,255,0.05)'; }}
                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.backgroundColor = 'rgba(255,255,255,0.03)'; }}
              />
              <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 0 }}>
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, color: '#f87171', fontSize: 12 }}>
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{ padding: '13px', borderRadius: 12, background: loading ? 'rgba(0, 229, 255, 0.5)' : 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)', border: 'none', color: '#fff', fontWeight: 800, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'opacity 0.2s, transform 0.2s', boxShadow: '0 4px 15px rgba(0, 229, 255, 0.2)', marginTop: 4 }}
            onMouseEnter={e => { if(!loading) e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
          >
            {loading ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Authorizing...</> : <><Shield size={14} /> Sign In as Super Admin</>}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 24 }}>
          🔒 Secure Socket Layer Encrypted
        </p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Admin Dashboard Component ────────────────────────────────────────────────
function AdminDashboard({ onLogout }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'active' | 'banned'
  const [sortBy, setSortBy] = useState('createdAt'); // 'createdAt' | 'name' | 'email'
  const [sortDir, setSortDir] = useState('desc');
  const [selectedUser, setSelectedUser] = useState(null);
  const [toast, setToast] = useState(null);

  // Live Sync State
  const [refreshCountdown, setRefreshCountdown] = useState(30);
  const [activityLogs, setActivityLogs] = useState([]);
  const [newToday, setNewToday] = useState(0);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastDuration, setBroadcastDuration] = useState('3600');
  const [broadcastLoading, setBroadcastLoading] = useState(false);

  useEffect(() => {
    const cutoff = Date.now() - 86400000;
    const count = users.filter(u => u.createdAt && new Date(u.createdAt).getTime() > cutoff).length;
    Promise.resolve().then(() => setNewToday(count));
  }, [users]);




  const showToast = (msg, type = 'success', duration = 4000) => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), duration);
  };

  const handleBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastMsg.trim()) return;
    setBroadcastLoading(true);
    try {
      const token = sessionStorage.getItem(ADMIN_TOKEN_KEY);
      const res = await fetch(`${API_BASE}/api/admin/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `AdminBearer ${token}` },
        body: JSON.stringify({
          message: broadcastMsg.trim(),
          duration: parseInt(broadcastDuration, 10)
        })
      });
      if (res.ok) {
        showToast("Global broadcast notification dispatched successfully!", "success");
        setActivityLogs(prev => [`ADMIN: Dispatched broadcast: "${broadcastMsg.trim()}" (${broadcastDuration}s)`, ...prev].slice(0, 15));
        setBroadcastMsg('');
      } else {
        showToast("Failed to dispatch broadcast.", "error");
      }
    } catch {
      showToast("Network error broadcasting message.", "error");
    } finally {
      setBroadcastLoading(false);
    }
  };


  const fetchUsers = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setError('');
    try {
      const token = sessionStorage.getItem(ADMIN_TOKEN_KEY);
      const res = await fetch(`${API_BASE}/api/admin/users`, {
        headers: { Authorization: `AdminBearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const apiUsers = data.users || [];
        setUsers(apiUsers);

        // Update live logs when active playback details are fetched
        apiUsers.forEach((u) => {
          if (u.activity?.track) {
            const logMsg = `${u.name || u.email} playing: "${u.activity.track.name}" (${u.activity.device})`;
            setActivityLogs(prev => {
              if (prev.includes(logMsg)) return prev;
              return [logMsg, ...prev].slice(0, 15);
            });
          }
        });
      } else {
        setUsers(getMockUsers());
      }
    } catch {
      setUsers(getMockUsers());
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch immediately
  useEffect(() => {
    Promise.resolve().then(() => {
      fetchUsers();
    });
  }, [fetchUsers]);


  // Auto-refresh every 30 seconds (reduced from 5s to cut network noise)
  useEffect(() => {
    const timer = setInterval(() => {
      setRefreshCountdown(prev => {
        if (prev <= 1) {
          if (document.visibilityState === 'visible') fetchUsers(true);
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [fetchUsers]);

  const performAction = async (action, user, body = {}) => {
    try {
      const token = sessionStorage.getItem(ADMIN_TOKEN_KEY);
      const res = await fetch(`${API_BASE}/api/admin/users/${user.id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `AdminBearer ${token}` },
        body: JSON.stringify(body)
      });
      return res.ok;
    } catch {
      return false;
    }
  };

  const handleBan = async (user) => {
    if (!confirm(`Are you sure you want to ban ${user.name || user.email}?`)) return;
    const ok = await performAction('ban', user);
    if (ok) {
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, banned: true } : u));
      showToast(`${user.name || user.email} has been banned.`, 'warning');
      setActivityLogs(prev => [`ADMIN: Banned ${user.email}`, ...prev].slice(0, 15));
    } else {
      showToast('Action failed', 'error');
    }
  };

  const handleUnban = async (user) => {
    const ok = await performAction('unban', user);
    if (ok) {
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, banned: false } : u));
      showToast(`${user.name || user.email} has been unbanned.`, 'success');
      setActivityLogs(prev => [`ADMIN: Unbanned ${user.email}`, ...prev].slice(0, 15));
    } else {
      showToast('Action failed', 'error');
    }
  };

  const handleDelete = async (user) => {
    if (!confirm(`PERMANENTLY DELETE ${user.name || user.email}? This action cannot be undone.`)) return;
    const ok = await performAction('delete', user);
    if (ok) {
      setUsers(prev => prev.filter(u => u.id !== user.id));
      showToast(`${user.name || user.email} has been deleted.`, 'error');
      setActivityLogs(prev => [`ADMIN: Deleted ${user.email}`, ...prev].slice(0, 15));
    } else {
      showToast('Action failed', 'error');
    }
  };

  const handleResetPassword = async (user) => {
    const newPass = prompt(`Set new password for ${user.name || user.email}\n(minimum 6 characters — you can see this for 10 seconds after setting):`);
    if (newPass === null) return;
    const trimmed = newPass.trim();
    if (trimmed.length < 6) {
      showToast('Password must be at least 6 characters long', 'error');
      return;
    }
    const ok = await performAction('reset-password', user, { newPassword: trimmed });
    if (ok) {
      showToast(`✅ Password for ${user.name || user.email} has been reset successfully.`, 'success', 4000);
      setActivityLogs(prev => [`ADMIN: Reset password for ${user.email}`, ...prev].slice(0, 15));
    } else {
      showToast('Reset failed', 'error');
    }
  };


  const displayed = users
    .filter(u => {
      if (filter === 'active') return !u.banned;
      if (filter === 'banned') return u.banned;
      return true;
    })
    .filter(u => {
      const q = search.toLowerCase();
      return !q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.id?.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      let va = a[sortBy] || '', vb = b[sortBy] || '';
      if (sortDir === 'asc') return va > vb ? 1 : -1;
      return va < vb ? 1 : -1;
    });

  const onlineUsers = useMemo(() => users.filter(u => !!u.activity), [users]);
  const totalUsers  = users.length;
  const activeUsers = useMemo(() => users.filter(u => !u.banned).length, [users]);
  const bannedUsers = useMemo(() => users.filter(u => u.banned).length, [users]);



  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };
  const renderSortIcon = (col) => sortBy === col ? (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : null;

  return (
    <div style={{ height: '100vh', overflowY: 'auto', background: '#07080d', fontFamily: "'Outfit', 'Inter', sans-serif", color: '#fff' }}>
      
      {/* Dynamic Mobile CSS inject */}
      <style>{`
        /* Desktop layouts */
        .admin-page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 32px;
          max-width: 1400px;
          margin: 0 auto;
          min-height: 74px;
          background: rgba(8, 10, 18, 0.85);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          position: sticky;
          top: 0;
          z-index: 100;
          backdrop-filter: blur(30px);
          width: 100%;
          box-sizing: border-box;
        }
        .admin-main-container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 32px 32px 90px;
          display: flex;
          flex-direction: column;
          gap: 32px;
          box-sizing: border-box;
          width: 100%;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          width: 100%;
        }
        .stat-card {
          background: rgba(12, 14, 26, 0.75);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          padding: 22px 24px;
          backdrop-filter: blur(20px);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
          transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.25s ease;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 110px;
        }
        .stat-card:hover {
          transform: translateY(-3px);
          border-color: rgba(0, 229, 255, 0.3);
          box-shadow: 0 14px 40px rgba(0, 229, 255, 0.08);
        }
        .stat-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        .stat-card-label {
          font-size: 11px;
          color: rgba(255,255,255,0.45);
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .stat-card-icon-container {
          width: 38px;
          height: 38px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .stat-card-value {
          font-size: 32px;
          font-weight: 800;
          letter-spacing: -0.03em;
          color: #ffffff;
          line-height: 1.1;
        }
        .stat-card-sub {
          font-size: 11px;
          color: rgba(255,255,255,0.4);
          margin-top: 4px;
          font-weight: 500;
        }
        .active-user-card {
          background: linear-gradient(135deg, rgba(16, 18, 30, 0.85) 0%, rgba(10, 11, 19, 0.85) 100%);
          border: 1px solid rgba(0, 229, 255, 0.18);
          border-radius: 20px;
          padding: 22px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
          position: relative;
          backdrop-filter: blur(20px);
          transition: border-color 0.25s ease, transform 0.25s ease;
        }
        .active-user-card:hover {
          border-color: rgba(0, 229, 255, 0.4);
          transform: translateY(-2px);
        }
        .admin-layout-split {
          display: grid;
          grid-template-columns: 1fr 380px;
          gap: 24px;
          align-items: start;
          width: 100%;
        }
        .user-directory-card {
          background: rgba(10, 12, 22, 0.75);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 24px;
          overflow: hidden;
          backdrop-filter: blur(24px);
          box-shadow: 0 12px 40px rgba(0,0,0,0.35);
        }
        .user-row-desktop {
          display: grid;
          grid-template-columns: 48px 2fr 1.3fr 110px 150px 170px;
          align-items: center;
          gap: 20px;
          padding: 16px 24px;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          transition: background 0.2s ease;
        }
        .user-row-desktop:hover {
          background: rgba(255,255,255,0.015) !important;
        }
        .user-row-mobile-card {
          display: none;
          padding: 14px 16px;
          flex-direction: column;
        }
        .online-dot-indicator {
          position: absolute;
          bottom: 0;
          right: 0;
          width: 9px;
          height: 9px;
          border-radius: 50%;
          border: 2px solid #0d0f1a;
          transition: all 0.2s ease;
        }
        .online-dot-indicator.online {
          background: #10b981;
          box-shadow: 0 0 6px #10b981;
          animation: pulse-green 2s infinite;
        }
        .online-dot-indicator.offline {
          background: #6b7280;
          box-shadow: none;
        }
        @keyframes pulse-green {
          0% {
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
          }
          70% {
            box-shadow: 0 0 0 4px rgba(16, 185, 129, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
          }
        }

        .status-badge-inline {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
        }
        .status-badge-inline.active {
          background: rgba(16,185,129,0.12);
          color: #34d399;
          border: 1px solid rgba(16,185,129,0.2);
        }
        .status-badge-inline.banned {
          background: rgba(239,68,68,0.12);
          color: #f87171;
          border: 1px solid rgba(239,68,68,0.2);
        }
        .user-row-date, .user-row-lastseen {
          font-size: 12px;
          color: rgba(255,255,255,0.5);
        }
        .mobile-row-label {
          display: none;
        }
        .user-row-actions {
          display: flex;
          gap: 6px;
          align-items: center;
        }
        .action-btn {
          padding: 6px 10px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          transition: all 0.2s;
        }
        .action-btn.text-btn {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.7);
        }
        .action-btn.success-btn {
          background: rgba(16,185,129,0.08);
          border: 1px solid rgba(16,185,129,0.2);
          color: #34d399;
        }
        .action-btn.warning-btn {
          background: rgba(251,191,36,0.08);
          border: 1px solid rgba(251,191,36,0.2);
          color: #fbbf24;
        }
        .action-btn.danger-btn-icon {
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.2);
          color: #f87171;
          padding: 6px 8px;
        }
        .action-btn:hover {
          opacity: 0.85;
          transform: scale(0.98);
        }
        .login-card {
          width: 90vw;
          max-width: 400px;
          background: rgba(10, 11, 20, 0.85);
          border: 1px solid rgba(0, 229, 255, 0.2);
          border-radius: 24px;
          padding: 36px;
          backdrop-filter: blur(30px);
          box-shadow: 0 20px 50px rgba(0,0,0,0.5);
        }
        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.85);
          backdrop-filter: blur(8px);
          z-index: 3000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }
        .modal-content {
          background: linear-gradient(180deg, #121422 0%, #080911 100%);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 24px;
          width: 100%;
          max-width: 460px;
          padding: 24px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.5);
        }
        .modal-action-btn {
          flex: 1;
          padding: 12px;
          border-radius: 12px;
          border: 1px solid transparent;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .modal-action-btn.success {
          background: rgba(16,185,129,0.1);
          border-color: rgba(16,185,129,0.3);
          color: #34d399;
        }
        .modal-action-btn.warning {
          background: rgba(251,191,36,0.1);
          border-color: rgba(251,191,36,0.3);
          color: #fbbf24;
        }
        .modal-action-btn.danger {
          background: rgba(239,68,68,0.1);
          border-color: rgba(239,68,68,0.3);
          color: #f87171;
        }

        /* ─── MOBILE RESPONSIVENESS MEDIA QUERIES ─── */
        @media (max-width: 768px) {
          .admin-page-header {
            flex-direction: column;
            height: auto;
            padding: 12px 16px;
            gap: 8px;
            align-items: stretch;
          }
          .admin-page-header > div {
            justify-content: center;
          }
          .admin-main-container {
            padding: 24px 16px 80px;
            gap: 20px;
            /* Enable CSS ordering on mobile */
            display: flex;
            flex-direction: column;
          }

          /* Compact 2x2 stats grid - always 2 columns on mobile */
          .stats-grid {
            order: 1;
            display: grid !important;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            flex: none;
          }
          .stat-card {
            padding: 16px 14px;
            min-width: 0;
            border-radius: 16px;
            flex: none;
          }
          .stat-card-value {
            font-size: 20px;
            line-height: 1.1;
          }
          .stat-card-label {
            font-size: 9px;
          }
          .stat-card-sub {
            font-size: 9px;
            margin-top: 2px;
          }
          .stat-card-icon-container {
            width: 28px;
            height: 28px;
          }
          .stat-card-header {
            margin-bottom: 6px;
          }

          /* Members Directory comes FIRST on mobile (order: 2) */
          .admin-layout-split {
            order: 2;
            grid-template-columns: 1fr;
            gap: 20px;
          }

          /* Live sessions comes AFTER members on mobile (order: 3) */
          .section-live-sessions {
            order: 3;
          }

          /* Hide desktop table rows & headers; show mobile cards */
          .user-row-desktop {
            display: none !important;
          }
          .user-row-desktop-headers {
            display: none !important;
          }
          .user-row-mobile-card {
            display: flex !important;
          }
          .action-btn {
            padding: 8px 10px;
            font-size: 12px;
          }
        }
        
        @media (max-width: 420px) {
          .login-card {
            padding: 24px;
          }
          .inspector-fields-grid {
            grid-template-columns: 1fr !important;
          }
        }
        
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.97); } }
        @keyframes slideUp { from { transform: translateY(15px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>

      {/* Header */}
      <header className="admin-page-header">
        <div className="admin-brand-container" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <TunelyLogo size={34} />
          <div style={{ textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', fontFamily: 'var(--font-serif)' }}>Tunely<span style={{ color: 'var(--primary)' }}>.</span> Admin</span>
              <span style={{ padding: '2px 7px', borderRadius: 6, background: 'rgba(239, 68, 68, 0.18)', color: '#f87171', fontSize: 9, fontWeight: 800, border: '1px solid rgba(239, 68, 68, 0.3)' }}>ROOT</span>
              <span style={{ padding: '2px 7px', borderRadius: 6, background: 'rgba(16, 185, 129, 0.12)', color: '#34d399', fontSize: 9, fontWeight: 700, border: '1px solid rgba(16, 185, 129, 0.25)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', display: 'inline-block', boxShadow: '0 0 6px #34d399' }} /> D1 SQL Live
              </span>
            </div>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', display: 'block', marginTop: 1 }}>Cloudflare KV & Real-time Database Controller</span>
          </div>
        </div>

        {/* Sync details & Exit */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
            background: 'rgba(0, 229, 255, 0.05)', border: '1px solid rgba(0, 229, 255, 0.15)',
            borderRadius: 16, fontSize: 11, color: '#00e5ff', fontWeight: 600
          }}>
            <Zap size={12} style={{ animation: 'pulse 1.2s infinite' }} />
            <span>Sync in {refreshCountdown}s</span>
          </div>

          <button onClick={() => fetchUsers(false)} style={{
            width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'rgba(255,255,255,0.7)'
          }}>
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>

          <button onClick={() => { sessionStorage.removeItem(ADMIN_TOKEN_KEY); if (onLogout) onLogout(); window.location.href = '/'; }} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
            borderRadius: 10, background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#f87171', cursor: 'pointer', fontWeight: 700, fontSize: 12
          }}>
            <LogOut size={12} /> Exit
          </button>
        </div>
      </header>

      <main className="admin-main-container">
        
        {/* Stat Cards */}
        <div className="stats-grid">
          <StatCard icon={Users} label="Total Members" value={totalUsers} color="linear-gradient(135deg, #00e5ff, #0084ff)" glowColor="#00e5ff" sub={`${onlineUsers.length} online now`} />
          <StatCard icon={UserCheck} label="Active Users" value={activeUsers} color="linear-gradient(135deg, #10b981, #059669)" glowColor="#10b981" sub="Unrestricted status" />
          <StatCard icon={UserX} label="Banned Users" value={bannedUsers} color="linear-gradient(135deg, #ef4444, #dc2626)" glowColor="#ef4444" sub="Blocked from app" />
          <StatCard icon={Activity} label="Joined Today" value={newToday} color="linear-gradient(135deg, #a78bfa, #7c3aed)" glowColor="#a78bfa" sub="New account sign-ups" />
        </div>

        {/* Live Active sessions */}
        <div className="section-live-sessions" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8, letterSpacing: '-0.02em' }}>
              <Radio size={16} color="#00e5ff" style={{ animation: 'pulse 1.5s infinite' }} />
              Live Online Activity
            </h2>
            <span style={{ fontSize: 10, color: '#00e5ff', background: 'rgba(0, 229, 255, 0.1)', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>
              {onlineUsers.length} active
            </span>
          </div>

          {onlineUsers.length === 0 ? (
            <div style={{
              background: 'rgba(15, 17, 28, 0.3)', border: '1px dashed rgba(255,255,255,0.05)',
              borderRadius: 16, padding: '32px 16px', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 8, color: 'rgba(255,255,255,0.25)', textAlign: 'center'
            }}>
              <Radio size={24} style={{ opacity: 0.3 }} />
              <div style={{ fontSize: 13, fontWeight: 600 }}>No users currently playing music</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.15)' }}>Active sessions list automatically when someone stream on Tunely</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {onlineUsers.map(session => (
                <ActiveUserCard
                  key={session.id}
                  session={session}
                  onBan={handleBan}
                  onUnban={handleUnban}
                  onDelete={handleDelete}
                  onViewDetails={setSelectedUser}
                />
              ))}
            </div>
          )}
        </div>

        {/* User directory + events split */}
        <div className="admin-layout-split">
          
          {/* User Directory */}
          <div className="user-directory-card">
            
            {/* Headers and filters */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justify: 'space-between', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Users size={16} color="rgba(255,255,255,0.5)" />
                  <span style={{ fontWeight: 800, fontSize: 15 }}>Members Directory</span>
                  <span style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 20, padding: '1px 8px', fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{displayed.length}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, width: '100%', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: '1 1 200px' }}>
                  <Search size={12} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)' }} />
                  <input
                    value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search name, email, ID..."
                    style={{ width: '100%', paddingLeft: 32, paddingRight: 10, paddingTop: 8, paddingBottom: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#fff', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {['all', 'active', 'banned'].map(f => (
                    <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 12px', borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1px solid', background: filter === f ? 'rgba(0,229,255,0.1)' : 'transparent', borderColor: filter === f ? 'rgba(0,229,255,0.3)' : 'rgba(255,255,255,0.08)', color: filter === f ? '#00e5ff' : 'rgba(255,255,255,0.5)', textTransform: 'capitalize' }}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Desktop Table Headers */}
            <div className="user-row-desktop-headers" style={{ display: 'grid', gridTemplateColumns: '48px 2fr 1.3fr 110px 150px 170px', gap: 20, padding: '12px 24px', background: 'rgba(255,255,255,0.015)', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', alignItems: 'center' }}>
              <div />
              <button onClick={() => toggleSort('name')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 'inherit', fontWeight: 'inherit', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 4, letterSpacing: 'inherit', textTransform: 'inherit' }}>
                Name/Email {renderSortIcon('name')}
              </button>
              <button onClick={() => toggleSort('createdAt')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 'inherit', fontWeight: 'inherit', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 4, letterSpacing: 'inherit', textTransform: 'inherit' }}>
                Join Date {renderSortIcon('createdAt')}
              </button>
              <div>Status</div>
              <button onClick={() => toggleSort('lastSeen')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 'inherit', fontWeight: 'inherit', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 4, letterSpacing: 'inherit', textTransform: 'inherit' }}>
                Last Active {renderSortIcon('lastSeen')}
              </button>
              <div>Actions</div>
            </div>

            {/* Rows list */}
            {loading ? (
              <div style={{ padding: '60px 0', textAlign: 'center', color: 'rgba(255,255,255,0.35)' }}>
                <RefreshCw size={28} style={{ animation: 'spin 1.2s linear infinite', marginBottom: 12 }} />
                <div style={{ fontWeight: 600, fontSize: 13 }}>Syncing directory...</div>
              </div>
            ) : error ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#f87171', fontSize: 13 }}>{error}</div>
            ) : displayed.length === 0 ? (
              <div style={{ padding: '60px 0', textAlign: 'center', color: 'rgba(255,255,255,0.25)' }}>
                <Users size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
                <div style={{ fontWeight: 600, fontSize: 13 }}>No users found</div>
              </div>
            ) : (
              <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                {displayed.map(u => (
                  <UserRow
                    key={u.id}
                    user={u}
                    onBan={handleBan}
                    onUnban={handleUnban}
                    onDelete={handleDelete}
                    onResetPassword={handleResetPassword}
                    onViewDetails={setSelectedUser}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Live events log */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Global Broadcast Dispatcher */}
            <div style={{ background: 'rgba(15, 17, 28, 0.75)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: 20, padding: 20, backdropFilter: 'blur(20px)', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Radio size={16} color="#00e5ff" style={{ animation: 'pulse 1.2s infinite' }} />
                <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: '-0.02em' }}>Dispatch Global Broadcast</span>
              </div>
              <form onSubmit={handleBroadcast} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <textarea
                  value={broadcastMsg}
                  onChange={e => setBroadcastMsg(e.target.value)}
                  placeholder="Type an announcement to send to all active music listeners..."
                  style={{
                    width: '100%', minHeight: 80, padding: 12, background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, color: '#fff',
                    fontSize: 12, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box'
                  }}
                  required
                />
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 4 }}>
                    <label style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: '0.05em' }}>DISPLAY DURATION</label>
                    <select
                      value={broadcastDuration}
                      onChange={(e) => setBroadcastDuration(e.target.value)}
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 10,
                        color: '#fff',
                        padding: '10px 12px',
                        fontSize: 12,
                        fontFamily: "inherit",
                        outline: 'none',
                        cursor: 'pointer',
                        width: '100%'
                      }}
                    >
                      <option value="600" style={{ background: '#090a10', color: '#fff' }}>10 Minutes</option>
                      <option value="1800" style={{ background: '#090a10', color: '#fff' }}>30 Minutes</option>
                      <option value="3600" style={{ background: '#090a10', color: '#fff' }}>1 Hour</option>
                      <option value="86400" style={{ background: '#090a10', color: '#fff' }}>1 Day</option>
                      <option value="604800" style={{ background: '#090a10', color: '#fff' }}>7 Days</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%', paddingTop: 18 }}>
                    <button
                      type="submit"
                      disabled={broadcastLoading || !broadcastMsg.trim()}
                      style={{
                        padding: '10px 18px', borderRadius: 10,
                        background: broadcastLoading || !broadcastMsg.trim() ? 'rgba(0, 229, 255, 0.25)' : 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
                        border: 'none', color: '#fff', fontWeight: 700, fontSize: 12,
                        cursor: broadcastLoading || !broadcastMsg.trim() ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        height: 38
                      }}
                    >
                      {broadcastLoading ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={12} />}
                      Send Alert
                    </button>
                  </div>
                </div>
              </form>
            </div>

            <div style={{ background: 'rgba(10, 12, 20, 0.65)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, padding: 20, backdropFilter: 'blur(20px)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Activity size={16} color="#00e5ff" style={{ animation: 'pulse 1.2s infinite' }} />
                <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: '-0.02em' }}>Live Audit Stream</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 300, overflowY: 'auto' }}>
                {activityLogs.length === 0 ? (
                  <div style={{ padding: '30px 0', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: 11, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                    <Clock size={20} style={{ opacity: 0.3 }} />
                    <span>Awaiting new events...</span>
                  </div>
                ) : (
                  activityLogs.map((log, idx) => (
                    <div key={idx} style={{
                      padding: 10, borderRadius: 10, background: 'rgba(0,0,0,0.2)',
                      borderLeft: '3px solid #00e5ff', fontSize: 11, color: 'rgba(255,255,255,0.8)',
                      display: 'flex', gap: 6, flexDirection: 'column'
                    }}>
                      <div style={{ fontWeight: 500, lineHeight: '1.4' }}>{log}</div>
                      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', textAlign: 'right' }}>{new Date().toLocaleTimeString()}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

        </div>

      </main>

      {/* User details inspection modal */}
      {selectedUser && (
        <UserDetailModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onBan={u => { handleBan(u); setSelectedUser(null); }}
          onUnban={u => { handleUnban(u); setSelectedUser(null); }}
          onDelete={u => { handleDelete(u); setSelectedUser(null); }}
          onResetPassword={u => { handleResetPassword(u); setSelectedUser(null); }}
        />
      )}

      {/* Toast popup */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, padding: '12px 20px', borderRadius: 12,
          background: toast.type === 'success' ? 'rgba(16,185,129,0.95)' : toast.type === 'error' ? 'rgba(239,68,68,0.95)' : 'rgba(251,191,36,0.95)',
          color: '#fff', fontWeight: 700, fontSize: 13, zIndex: 9999, backdropFilter: 'blur(10px)',
          boxShadow: '0 8px 30px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)',
          animation: 'slideUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ─── Pre-populated detailed mock users if D1 database has no users ────────────
function getMockUsers() {
  return [
    {
      id: 'usr_001', name: 'Rahul Sharma', email: 'rahul@gmail.com',
      createdAt: new Date(Date.now() - 86400000 * 5).toISOString(), lastSeen: new Date().toISOString(),
      banned: false,
      activity: {
        track: {
          id: 'rjkrTnma', name: 'Kesariya', subtitle: 'Arijit Singh',
          artists: { primary: [{ name: 'Arijit Singh' }] },
          image: [{ url: 'https://c.saavncdn.com/191/Kesariya-From-Brahmastra-Hindi-2022-20220717092820-150x150.jpg' }, { url: 'https://c.saavncdn.com/191/Kesariya-From-Brahmastra-Hindi-2022-20220717092820-500x500.jpg' }]
        },
        isPlaying: true, progress: 48, device: 'Desktop Chrome', ip: '103.24.12.87', lastActive: new Date().toISOString()
      }
    },
    {
      id: 'usr_002', name: 'Priya Patel', email: 'priya@gmail.com',
      createdAt: new Date(Date.now() - 86400000 * 12).toISOString(), lastSeen: new Date(Date.now() - 600000).toISOString(),
      banned: false,
      activity: {
        track: {
          id: '0W6DtW_N', name: 'Believer', subtitle: 'Imagine Dragons',
          artists: { primary: [{ name: 'Imagine Dragons' }] },
          image: [{ url: 'https://c.saavncdn.com/027/Evolve-English-2017-150x150.jpg' }, { url: 'https://c.saavncdn.com/027/Evolve-English-2017-500x500.jpg' }]
        },
        isPlaying: false, progress: 124, device: 'iPhone Mobile App', ip: '223.187.9.43', lastActive: new Date().toISOString()
      }
    },
    { id: 'usr_003', name: 'Amit Kumar', email: 'amit@hotmail.com', createdAt: new Date(Date.now() - 86400000 * 30).toISOString(), lastSeen: new Date(Date.now() - 86400000 * 3).toISOString(), banned: true },
    {
      id: 'usr_004', name: 'Sneha Joshi', email: 'sneha@yahoo.com',
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(), lastSeen: new Date().toISOString(),
      banned: false,
      activity: {
        track: {
          id: 'EbFWakDs', name: 'Tu Hain Toh', subtitle: 'Arijit Singh',
          artists: { primary: [{ name: 'Arijit Singh' }] },
          image: [{ url: 'https://c.saavncdn.com/833/Tu-Hai-Toh-From-Mr-And-Mrs-Mahi-Hindi-2024-20240523221021-150x150.jpg' }]
        },
        isPlaying: true, progress: 92, device: 'Android Mobile App', ip: '103.45.109.11', lastActive: new Date().toISOString()
      }
    },
    { id: 'usr_005', name: 'Vikram Singh', email: 'vikram@gmail.com', createdAt: new Date(Date.now() - 86400000 * 60).toISOString(), lastSeen: new Date(Date.now() - 86400000 * 14).toISOString(), banned: false },
    { id: 'usr_006', name: 'Deepa Menon', email: 'deepa@outlook.com', createdAt: new Date(Date.now() - 86400000 * 1).toISOString(), lastSeen: new Date(Date.now() - 3600000 * 4).toISOString(), banned: false },
  ];
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function AdminPanel() {
  const [adminToken, setAdminToken] = useState(() => sessionStorage.getItem(ADMIN_TOKEN_KEY));

  if (!adminToken) {
    return <AdminLogin onLogin={setAdminToken} />;
  }
  return (
    <AdminDashboard onLogout={() => {
      sessionStorage.removeItem(ADMIN_TOKEN_KEY);
      setAdminToken(null);
      window.location.href = '/';
    }} />
  );
}
