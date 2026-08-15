import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, AuthSession } from '../types/user';
import { secureStorageService } from '../services/secureStorageService';
import { storageService } from '../services/storageService';
import { apiService } from '../services/apiService';

const AUTH_SECURE_TOKEN_KEY = 'tunely_auth_token';
const AUTH_USER_PROFILE_KEY = 'tunely_user_profile';

export interface AuthContextType {
  token: string | null;
  user: User | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  bannedMessage: string | null;
  loginAsGuest: () => Promise<void>;
  logout: () => Promise<void>;
  updateUserProfile: (fields: Partial<User>) => Promise<void>;
  setAuthSession: (session: AuthSession) => Promise<void>;
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

  // Restore session from SecureStore & AsyncStorage on startup
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const savedToken = await secureStorageService.getSecureItem(AUTH_SECURE_TOKEN_KEY);
        const savedUser = await storageService.getItem<User | null>(AUTH_USER_PROFILE_KEY, null);

        if (savedToken) {
          setToken(savedToken);
          setUser(savedUser || { name: 'Tunely Listener', email: 'user@tunely.app' });
        }
      } catch (e) {
        console.warn('[AuthProvider] Failed to restore session:', e);
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

  const setAuthSession = async (session: AuthSession) => {
    setToken(session.token);
    setUser(session.user);
    if (session.token) {
      await secureStorageService.setSecureItem(AUTH_SECURE_TOKEN_KEY, session.token);
    } else {
      await secureStorageService.deleteSecureItem(AUTH_SECURE_TOKEN_KEY);
    }
    if (session.user) {
      await storageService.setItem(AUTH_USER_PROFILE_KEY, session.user);
    } else {
      await storageService.removeItem(AUTH_USER_PROFILE_KEY);
    }
  };

  const loginAsGuest = async () => {
    const guestUser: User = {
      name: 'Guest Listener',
      email: 'Guest Mode',
      isGuest: true,
    };
    await setAuthSession({ token: 'guest_token', user: guestUser });
  };

  const logout = async () => {
    setToken(null);
    setUser(null);
    await secureStorageService.deleteSecureItem(AUTH_SECURE_TOKEN_KEY);
    await storageService.removeItem(AUTH_USER_PROFILE_KEY);
  };

  const updateUserProfile = async (fields: Partial<User>) => {
    if (!user) return;
    const updated = { ...user, ...fields };
    setUser(updated);
    await storageService.setItem(AUTH_USER_PROFILE_KEY, updated);

    if (token && token !== 'guest_token') {
      try {
        await apiService.put('/api/auth/profile', fields, { token });
      } catch (e) {
        console.warn('[AuthProvider] Failed to sync profile to backend:', e);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isLoggedIn: !!token,
        isLoading,
        bannedMessage,
        loginAsGuest,
        logout,
        updateUserProfile,
        setAuthSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
