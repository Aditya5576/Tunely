import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, AuthSession } from '../types/user';
import { secureStorageService } from '../services/secureStorageService';
import { storageService } from '../services/storageService';
import { apiService, ApiError } from '../services/apiService';

const AUTH_SECURE_TOKEN_KEY = 'tunely_auth_token';
const AUTH_USER_PROFILE_KEY = 'tunely_user_profile';
const GUEST_PROFILE_KEY = 'tunely_guest_profile';

export interface AuthContextType {
  token: string | null;
  user: User | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  bannedMessage: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  loginAsGuest: () => Promise<void>;
  logout: () => Promise<void>;
  updateUserProfile: (fields: Partial<User>) => Promise<void>;
  setAuthSession: (session: AuthSession) => Promise<void>;
  authFetch: <T>(endpoint: string, options?: any) => Promise<T>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [bannedMessage, setBannedMessage] = useState<string | null>(null);

  const clearSession = useCallback(async () => {
    setToken(null);
    setUser(null);
    await secureStorageService.deleteSecureItem(AUTH_SECURE_TOKEN_KEY);
    await storageService.removeItem(AUTH_USER_PROFILE_KEY);
  }, []);

  const verifySession = useCallback(async (savedToken: string) => {
    if (savedToken === 'guest_token') return;

    try {
      const response = await apiService.getCurrentUser(savedToken);
      if (response && response.user) {
        setUser(response.user);
        await storageService.setItem(AUTH_USER_PROFILE_KEY, response.user);
      }
    } catch (error: any) {
      if (error instanceof ApiError) {
        if (error.status === 403) {
          const msg = error.data?.message || 'Your account has been suspended by an administrator.';
          setBannedMessage(msg);
          await clearSession();
          return;
        }
        if (error.status === 401) {
          await clearSession();
          return;
        }
      }
      console.warn('[AuthProvider] Session verification failed, using offline cached user profile:', error);
    }
  }, [clearSession]);

  // Restore session on startup
  useEffect(() => {
    let isMounted = true;
    const restoreSession = async () => {
      try {
        const savedToken = await secureStorageService.getSecureItem(AUTH_SECURE_TOKEN_KEY);
        const savedUser = await storageService.getItem<User | null>(AUTH_USER_PROFILE_KEY, null);

        if (!isMounted) return;

        if (savedToken) {
          setToken(savedToken);
          setUser(savedUser);
          if (savedToken !== 'guest_token') {
            await verifySession(savedToken);
          }
        }
      } catch (e) {
        console.warn('[AuthProvider] Restore session failed:', e);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    restoreSession();
    return () => { isMounted = false; };
  }, [verifySession]);

  const setAuthSession = async (session: AuthSession) => {
    setToken(session.token);
    setUser(session.user);
    setBannedMessage(null);

    if (session.token) {
      await secureStorageService.setSecureItem(AUTH_SECURE_TOKEN_KEY, session.token);
    } else {
      await secureStorageService.deleteSecureItem(AUTH_SECURE_TOKEN_KEY);
    }

    if (session.user) {
      if (session.user.isGuest) {
        await storageService.setItem(GUEST_PROFILE_KEY, session.user);
      } else {
        await storageService.setItem(AUTH_USER_PROFILE_KEY, session.user);
      }
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await apiService.login(email, password);
      if (response && response.data) {
        await setAuthSession({
          token: response.data.token,
          user: response.data.user,
        });
      }
    } catch (error: any) {
      if (error instanceof ApiError && error.status === 403) {
        setBannedMessage(error.data?.message || 'Your account is banned.');
      }
      throw error;
    }
  };

  const register = async (email: string, name: string, password: string) => {
    const response = await apiService.register(email, name, password);
    if (response && response.data) {
      await setAuthSession({
        token: response.data.token,
        user: response.data.user,
      });
    }
  };

  const loginAsGuest = async () => {
    // Check if guest profile exists in AsyncStorage
    const savedGuest = await storageService.getItem<User | null>(GUEST_PROFILE_KEY, null);
    const guestUser: User = savedGuest || {
      name: 'Guest Listener',
      email: 'Guest Mode',
      isGuest: true,
    };
    await setAuthSession({ token: 'guest_token', user: guestUser });
  };

  const logout = async () => {
    setBannedMessage(null);
    await clearSession();
  };

  const updateUserProfile = async (fields: Partial<User>) => {
    if (!user) return;
    const updated = { ...user, ...fields };
    setUser(updated);

    if (user.isGuest) {
      await storageService.setItem(GUEST_PROFILE_KEY, updated);
      return;
    }

    await storageService.setItem(AUTH_USER_PROFILE_KEY, updated);

    if (token && token !== 'guest_token') {
      try {
        await apiService.updateProfile(fields, token);
      } catch (e) {
        console.warn('[AuthProvider] Profile update sync failed:', e);
      }
    }
  };

  const authFetch = async <T,>(endpoint: string, options: any = {}): Promise<T> => {
    if (!token || token === 'guest_token') {
      throw new ApiError('Guest mode cannot call protected endpoints', 401);
    }
    return apiService.get<T>(endpoint, { ...options, token });
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isLoggedIn: !!token,
        isLoading,
        bannedMessage,
        login,
        register,
        loginAsGuest,
        logout,
        updateUserProfile,
        setAuthSession,
        authFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
