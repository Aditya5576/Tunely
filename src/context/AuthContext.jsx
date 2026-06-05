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
  };

  const verifySession = useCallback(async (t) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${t}` }
      });
      if (!res.ok) {
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
      if (!res.ok) return { success: false, error: data.message || 'Login failed' };
      setToken(data.data.token);
      setUser(data.data.user);
      persistSession(data.data.token, data.data.user);
      return { success: true };
    } catch {
      return { success: false, error: 'Network error. Please check your connection.' };
    }
  };

  /** Logout — deletes server session and clears local state */
  const logout = async () => {
    try {
      if (token) {
        await fetch(`${API_BASE}/api/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
      }
    } catch { /* ignore network errors on logout */ }
    clearSession();
  };

  /** Helper: make an authenticated API request */
  const authFetch = useCallback(async (url, options = {}) => {
    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`
      }
    });
  }, [token]);

  const isLoggedIn = !!user && !!token;

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isLoggedIn,
      isLoading,
      login,
      logout,
      register,
      authFetch
    }}>
      {children}
    </AuthContext.Provider>
  );
};
