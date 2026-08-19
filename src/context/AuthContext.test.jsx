import { render, act, waitFor } from '@testing-library/react';
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';

// Helper component to extract AuthContext values in tests
function TestConsumer({ onContext }) {
  const auth = useAuth();
  if (onContext) onContext(auth);
  return (
    <div>
      <span data-testid="user-name">{auth?.user?.name || 'none'}</span>
      <span data-testid="is-logged-in">{auth?.isLoggedIn ? 'yes' : 'no'}</span>
      <span data-testid="banned-msg">{auth?.bannedMessage || 'none'}</span>
    </div>
  );
}

describe('AuthContext - Profile Updates & Password Reset Unit Tests', () => {
  let mockFetch;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();

    mockFetch = vi.fn();
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // ─── 1. updateUserProfile tests ───────────────────────────────────────────

  describe('updateUserProfile', () => {
    it('updates local state, persists session, and sends PUT /api/auth/profile when authenticated', async () => {
      // Seed existing authenticated session in localStorage
      const initialUser = { id: 'u123', name: 'Alice Listener', email: 'alice@example.com' };
      const initialToken = 'valid_hmac_token';
      localStorage.setItem('tunely_auth', JSON.stringify({ token: initialToken, user: initialUser }));

      // Mock verifySession background check
      mockFetch.mockImplementation(async (url) => {
        if (url.includes('/api/auth/me')) {
          return new Response(JSON.stringify({ success: true, data: initialUser }), { status: 200 });
        }
        if (url.includes('/api/auth/profile')) {
          return new Response(JSON.stringify({ success: true, message: 'Profile updated' }), { status: 200 });
        }
        return new Response('Not Found', { status: 404 });
      });

      let contextRef;
      render(
        <AuthProvider>
          <TestConsumer onContext={(ctx) => { contextRef = ctx; }} />
        </AuthProvider>
      );

      await waitFor(() => expect(contextRef.isLoading).toBe(false));
      expect(contextRef.user.name).toBe('Alice Listener');

      // Execute profile update
      await act(async () => {
        await contextRef.updateUserProfile({ name: 'Alice Updated' });
      });

      // 1. Local state updated
      expect(contextRef.user.name).toBe('Alice Updated');

      // 2. LocalStorage updated with new user details
      const stored = JSON.parse(localStorage.getItem('tunely_auth'));
      expect(stored.user.name).toBe('Alice Updated');
      expect(stored.token).toBe(initialToken);

      // 3. API request sent with correct method, headers, and body
      const profileCall = mockFetch.mock.calls.find(call => call[0].includes('/api/auth/profile'));
      expect(profileCall).toBeDefined();
      expect(profileCall[1].method).toBe('PUT');
      expect(profileCall[1].headers['Authorization']).toBe(`Bearer ${initialToken}`);
      expect(JSON.parse(profileCall[1].body)).toEqual({ name: 'Alice Updated' });
    });

    it('updates guest profile locally without sending network API requests in guest mode', async () => {
      // Seed guest profile
      const guestUser = { id: 'guest_user', name: 'Guest Listener', isGuest: true };
      localStorage.setItem('tunely_guest_profile', JSON.stringify(guestUser));

      let contextRef;
      render(
        <AuthProvider>
          <TestConsumer onContext={(ctx) => { contextRef = ctx; }} />
        </AuthProvider>
      );

      await waitFor(() => expect(contextRef.isLoading).toBe(false));

      // Execute guest profile update
      await act(async () => {
        await contextRef.updateUserProfile({ name: 'Renamed Guest' });
      });

      expect(contextRef.user.name).toBe('Renamed Guest');
      const storedGuest = JSON.parse(localStorage.getItem('tunely_guest_profile'));
      expect(storedGuest.name).toBe('Renamed Guest');

      // Zero network fetch calls made for profile update
      const profileCall = mockFetch.mock.calls.find(call => call[0].includes('/api/auth/profile'));
      expect(profileCall).toBeUndefined();
    });

    it('retains local user state safely when backend PUT /api/auth/profile network call fails', async () => {
      const initialUser = { id: 'u123', name: 'Bob', email: 'bob@example.com' };
      const initialToken = 'bob_token';
      localStorage.setItem('tunely_auth', JSON.stringify({ token: initialToken, user: initialUser }));

      mockFetch.mockImplementation(async (url) => {
        if (url.includes('/api/auth/me')) {
          return new Response(JSON.stringify({ success: true, data: initialUser }), { status: 200 });
        }
        if (url.includes('/api/auth/profile')) {
          throw new Error('Network error on profile save');
        }
        return new Response('Not Found', { status: 404 });
      });

      let contextRef;
      render(
        <AuthProvider>
          <TestConsumer onContext={(ctx) => { contextRef = ctx; }} />
        </AuthProvider>
      );

      await waitFor(() => expect(contextRef.isLoading).toBe(false));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Execute profile update during network failure
      await act(async () => {
        await contextRef.updateUserProfile({ name: 'Bob New Name' });
      });

      // User state and session persist safely despite API failure
      expect(contextRef.user.name).toBe('Bob New Name');
      expect(contextRef.token).toBe(initialToken);
      const stored = JSON.parse(localStorage.getItem('tunely_auth'));
      expect(stored.user.name).toBe('Bob New Name');

      consoleSpy.mockRestore();
    });
  });

  // ─── 2. requestPasswordReset & confirmPasswordReset tests ────────────────

  describe('forgotPassword (request & confirm reset)', () => {
    it('requestPasswordReset sends correct POST payload and returns devOtp if present', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, message: 'OTP sent', devOtp: '123456' }), { status: 200 })
      );

      let contextRef;
      render(
        <AuthProvider>
          <TestConsumer onContext={(ctx) => { contextRef = ctx; }} />
        </AuthProvider>
      );

      let result;
      await act(async () => {
        result = await contextRef.requestPasswordReset('user@domain.com');
      });

      expect(result.success).toBe(true);
      expect(result.devOtp).toBe('123456');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/forgot-password'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'user@domain.com' })
        })
      );
    });

    it('requestPasswordReset handles suspended user account (403 banned) safely', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ success: false, banned: true, message: 'Account has been banned for policy violation' }),
          { status: 403 }
        )
      );

      let contextRef;
      render(
        <AuthProvider>
          <TestConsumer onContext={(ctx) => { contextRef = ctx; }} />
        </AuthProvider>
      );

      let result;
      await act(async () => {
        result = await contextRef.requestPasswordReset('banned@domain.com');
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Account has been banned for policy violation');
      expect(contextRef.bannedMessage).toBe('Account has been banned for policy violation');
    });

    it('requestPasswordReset returns network error message on fetch exception', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Failed to fetch'));

      let contextRef;
      render(
        <AuthProvider>
          <TestConsumer onContext={(ctx) => { contextRef = ctx; }} />
        </AuthProvider>
      );

      let result;
      await act(async () => {
        result = await contextRef.requestPasswordReset('user@domain.com');
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error. Please check your connection.');
    });

    it('confirmPasswordReset sends payload and logs user in on success', async () => {
      const newUser = { id: 'u888', email: 'reset@domain.com', name: 'Reset User' };
      const newToken = 'new_session_token_999';

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: { token: newToken, user: newUser }
          }),
          { status: 200 }
        )
      );

      let contextRef;
      render(
        <AuthProvider>
          <TestConsumer onContext={(ctx) => { contextRef = ctx; }} />
        </AuthProvider>
      );

      let result;
      await act(async () => {
        result = await contextRef.confirmPasswordReset('reset@domain.com', '123456', 'NewPass123!');
      });

      expect(result.success).toBe(true);
      expect(contextRef.token).toBe(newToken);
      expect(contextRef.user).toEqual(newUser);
      expect(contextRef.isLoggedIn).toBe(true);

      // Session persisted to localStorage
      const stored = JSON.parse(localStorage.getItem('tunely_auth'));
      expect(stored.token).toBe(newToken);
      expect(stored.user).toEqual(newUser);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/reset-password'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'reset@domain.com', otp: '123456', newPassword: 'NewPass123!' })
        })
      );
    });

    it('confirmPasswordReset handles invalid OTP / error response safely', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ success: false, message: 'Invalid or expired OTP code' }),
          { status: 400 }
        )
      );

      let contextRef;
      render(
        <AuthProvider>
          <TestConsumer onContext={(ctx) => { contextRef = ctx; }} />
        </AuthProvider>
      );

      let result;
      await act(async () => {
        result = await contextRef.confirmPasswordReset('reset@domain.com', '999999', 'NewPass123!');
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid or expired OTP code');
      expect(contextRef.isLoggedIn).toBe(false);
    });
  });

  // ─── 3. Auth fetch & session revocation tests ─────────────────────────────

  describe('authFetch auto-logout on banned account', () => {
    it('authFetch automatically triggers clearSession and displays banned overlay when 403 banned is returned', async () => {
      const user = { id: 'u403', name: 'User 403' };
      const token = 'active_token_403';
      localStorage.setItem('tunely_auth', JSON.stringify({ token, user }));

      mockFetch.mockImplementation(async (url) => {
        if (url.includes('/api/auth/me')) {
          return new Response(JSON.stringify({ success: true, data: user }), { status: 200 });
        }
        if (url.includes('/api/user/playlists')) {
          return new Response(
            JSON.stringify({ success: false, banned: true, message: 'Your account was suspended by admin.' }),
            { status: 403 }
          );
        }
        return new Response('Not Found', { status: 404 });
      });

      let contextRef;
      render(
        <AuthProvider>
          <TestConsumer onContext={(ctx) => { contextRef = ctx; }} />
        </AuthProvider>
      );

      await waitFor(() => expect(contextRef.isLoading).toBe(false));

      await act(async () => {
        await contextRef.authFetch('https://jiosaavn-api.adityapatil2348.workers.dev/api/user/playlists');
      });

      expect(contextRef.bannedMessage).toBe('Your account was suspended by admin.');
      expect(contextRef.isLoggedIn).toBe(false);
      expect(localStorage.getItem('tunely_auth')).toBeNull();
    });
  });
});
