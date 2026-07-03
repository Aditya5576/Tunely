/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const API_BASE = (import.meta.env.VITE_API_BASE || 'https://jiosaavn-api.adityapatil2348.workers.dev').trim();
const AUTH_STORAGE_KEY = 'tunely_auth';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => {
    try {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed.token || null;
      }
    } catch {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
    return null;
  });

  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed.user || null;
      }
    } catch {
      // ignore
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState(true); // true while restoring session
  const [bannedMessage, setBannedMessage] = useState(null);

  const persistSession = (t, u) => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ token: t, user: u }));
  };

  const clearSession = () => {
    setToken(null);
    setUser(null);
    // Clear all user-specific localStorage keys so next person sees a clean state
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem('tunely_liked_songs');
    localStorage.removeItem('tunely_liked_songs_metadata');
    localStorage.removeItem('tunely_liked_songs_updated_at');
    localStorage.removeItem('spotify_custom_playlists');
    localStorage.removeItem('tunely_custom_playlists_updated_at');
    localStorage.removeItem('tunely_recently_played');
  };

  const verifySession = useCallback(async (t) => {
    if (t === 'guest_token') return; // Do not verify offline guest tokens with the backend
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${t}` }
      });
      if (res.status === 403) {
        // Could be banned — parse the body to confirm
        try {
          const data = await res.json();
          if (data.banned) {
            setBannedMessage(data.message || 'Your account has been suspended.');
          }
        } catch {}
        clearSession();
      } else if (!res.ok) {
        // Token expired or invalid — clear session silently
        clearSession();
      } else {
        const { data } = await res.json();
        setUser(data);
        persistSession(t, data);
      }
    } catch {
      // Network error — keep existing session, will re-verify next time
    }
  }, []);

  // Restore session from localStorage on mount
  useEffect(() => {
    if (token) {
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      verifySession(token);
    }
    setIsLoading(false);
  }, [token, verifySession]);

  /** Register a new account. Returns { success, error } */
  const register = async (email, name, password) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, password })
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.message || 'Registration failed' };
      setToken(data.data.token);
      setUser(data.data.user);
      persistSession(data.data.token, data.data.user);
      return { success: true };
    } catch {
      return { success: false, error: 'Network error. Please check your connection.' };
    }
  };

  /** Login with email + password. Returns { success, error } */
  const login = async (email, password) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.status === 403 && data.banned) {
        setBannedMessage(data.message || 'Your account has been suspended.');
        return { success: false, error: data.message };
      }
      if (!res.ok) return { success: false, error: data.message || 'Login failed' };
      setToken(data.data.token);
      setUser(data.data.user);
      persistSession(data.data.token, data.data.user);
      return { success: true };
    } catch {
      return { success: false, error: 'Network error. Please check your connection.' };
    }
  };

  /** Step 1: Request password reset OTP. Returns { success, error, devOtp } */
  const requestPasswordReset = async (email) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (res.status === 403 && data.banned) {
        setBannedMessage(data.message || 'Your account has been suspended.');
        return { success: false, error: data.message };
      }
      if (!res.ok) return { success: false, error: data.message || 'Failed to send reset code' };
      // devOtp is only present when no email API is configured (dev mode)
      return { success: true, devOtp: data.devOtp || null };
    } catch {
      return { success: false, error: 'Network error. Please check your connection.' };
    }
  };

  /** Step 2: Confirm OTP and set new password. Returns { success, error } */
  const confirmPasswordReset = async (email, otp, newPassword) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword })
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.message || 'Reset failed' };
      // Log user in with new session token
      setToken(data.data.token);
      setUser(data.data.user);
      persistSession(data.data.token, data.data.user);
      return { success: true };
    } catch {
      return { success: false, error: 'Network error. Please check your connection.' };
    }
  };


  /** Log in locally as a Guest with predefined limitations */
  const loginAsGuest = () => {
    const guestUser = {
      id: 'guest_user',
      name: 'Guest User',
      email: 'guest@tunely.com',
      isGuest: true
    };
    const guestToken = 'guest_token';
    clearSession(); // Wipe any existing user data (including recently played)
    setToken(guestToken);
    setUser(guestUser);
    persistSession(guestToken, guestUser);
    window.location.href = '/';
    return { success: true };
  };

  /** Logout — deletes server session and clears local state */
  const logout = async () => {
    try {
      if (token && token !== 'guest_token') {
        await fetch(`${API_BASE}/api/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
      }
    } catch { /* ignore network errors on logout */ }
    clearSession();
    window.location.href = '/';
  };

  /** Helper: make an authenticated API request. Auto-logs out on 403 banned. */
  const authFetch = useCallback(async (url, options = {}) => {
    if (token === 'guest_token') {
      return new Response(JSON.stringify({ success: false, message: 'Offline guest mode' }), { status: 403 });
    }
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`
      }
    });
    // Auto-logout if account is banned
    if (res.status === 403) {
      try {
        const data = await res.clone().json();
        if (data.banned) {
          setBannedMessage(data.message || 'Your account has been suspended.');
          clearSession();
        }
      } catch {}
    }
    return res;
  }, [token]);

  const isLoggedIn = !!user && !!token;

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isLoggedIn,
      isLoading,
      bannedMessage,
      clearBannedMessage: () => setBannedMessage(null),
      login,
      logout,
      register,
      requestPasswordReset,
      confirmPasswordReset,
      loginAsGuest,
      authFetch
    }}>
      {/* Banned overlay — shown immediately when account is suspended */}
      {bannedMessage && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #1a0505 0%, #0d0808 100%)',
            border: '1px solid rgba(239,68,68,0.4)', borderRadius: 24,
            padding: 36, maxWidth: 400, width: '100%', textAlign: 'center',
            fontFamily: "'Outfit', 'Inter', sans-serif", color: '#fff',
            boxShadow: '0 20px 60px rgba(239,68,68,0.2)'
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🚫</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#f87171', marginBottom: 8 }}>Account Suspended</h2>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, marginBottom: 24 }}>
              {bannedMessage}
            </p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>Contact support to appeal this decision.</p>
          </div>
        </div>
      )}
      {children}
    </AuthContext.Provider>
  );
};
