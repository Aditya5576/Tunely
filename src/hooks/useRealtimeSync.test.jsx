import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRealtimeSync } from './useRealtimeSync';

describe('useRealtimeSync Hook Architecture & Loop Prevention', () => {
  let mockSockets = [];
  let originalWindowWS;
  let originalGlobalWS;

  beforeEach(() => {
    mockSockets = [];
    vi.useFakeTimers();

    originalWindowWS = window.WebSocket;
    originalGlobalWS = global.WebSocket;

    const MockWS = vi.fn().mockImplementation(function (url) {
      this.url = url;
      this.readyState = 0;
      this.send = vi.fn();
      this.close = vi.fn((code, reason) => {
        this.readyState = 3;
        if (this.onclose) this.onclose({ code: code || 1000, reason: reason || 'Closed' });
      });
      this.onopen = null;
      this.onmessage = null;
      this.onerror = null;
      this.onclose = null;
      mockSockets.push(this);
    });

    window.WebSocket = MockWS;
    global.WebSocket = MockWS;
  });

  afterEach(() => {
    window.WebSocket = originalWindowWS;
    global.WebSocket = originalGlobalWS;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('1. Connects exactly ONE WebSocket per session', async () => {
    const authFetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, ticket: 'test-ticket-123' })
      })
    );

    const syncLiked = vi.fn();
    const syncPlaylists = vi.fn();

    renderHook(() => useRealtimeSync({
      isLoggedIn: true,
      user: { id: 'u1' },
      authFetch,
      syncLikedSongs: syncLiked,
      syncPlaylistsOnLogin: syncPlaylists
    }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(authFetch).toHaveBeenCalledTimes(1);
    expect(authFetch).toHaveBeenCalledWith(expect.stringContaining('/api/auth/ws-ticket'), expect.any(Object));
    expect(mockSockets.length).toBe(1);
  });

  it('2. Parent component rerenders with new callback references DO NOT reconnect the WebSocket', async () => {
    const authFetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, ticket: 'test-ticket-456' })
      })
    );

    let syncLiked = vi.fn();
    let syncPlaylists = vi.fn();

    const { rerender } = renderHook(
      ({ syncLikedSongs, syncPlaylistsOnLogin }) => useRealtimeSync({
        isLoggedIn: true,
        user: { id: 'u1' },
        authFetch,
        syncLikedSongs,
        syncPlaylistsOnLogin
      }),
      {
        initialProps: {
          syncLikedSongs: syncLiked,
          syncPlaylistsOnLogin: syncPlaylists
        }
      }
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(mockSockets.length).toBe(1);
    const initialSocket = mockSockets[0];

    // Trigger 5 consecutive rerenders with new function instances (simulating React state updates)
    for (let i = 0; i < 5; i++) {
      rerender({
        syncLikedSongs: vi.fn(),
        syncPlaylistsOnLogin: vi.fn()
      });
    }

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    // Verification: WebSocket was NEVER closed or recreated
    expect(mockSockets.length).toBe(1);
    expect(initialSocket.close).not.toHaveBeenCalled();
    expect(authFetch).toHaveBeenCalledTimes(1);
  });

  it('3. Throttles reconciliation on socket.onopen to prevent duplicate sync storms', async () => {
    const authFetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, ticket: 'test-ticket-789' })
      })
    );

    const syncPlaylists = vi.fn();
    const syncLiked = vi.fn();

    renderHook(() => useRealtimeSync({
      isLoggedIn: true,
      user: { id: 'u1' },
      authFetch,
      syncLikedSongs: syncLiked,
      syncPlaylistsOnLogin: syncPlaylists
    }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(mockSockets.length).toBe(1);
    const socket = mockSockets[0];

    // Trigger onopen #1
    act(() => {
      if (socket.onopen) socket.onopen();
    });

    expect(syncLiked).toHaveBeenCalledTimes(1);
    expect(syncPlaylists).toHaveBeenCalledTimes(1);

    // Immediate redundant onopen within 15s cooldown
    act(() => {
      if (socket.onopen) socket.onopen();
    });

    // Verification: Should still be 1 (throttled)
    expect(syncLiked).toHaveBeenCalledTimes(1);
    expect(syncPlaylists).toHaveBeenCalledTimes(1);

    // Advance time past 15s cooldown
    await act(async () => {
      await vi.advanceTimersByTimeAsync(16000);
    });

    // Trigger onopen after cooldown
    act(() => {
      if (socket.onopen) socket.onopen();
    });

    expect(syncLiked).toHaveBeenCalledTimes(2);
    expect(syncPlaylists).toHaveBeenCalledTimes(2);
  });

  it('4. Genuine disconnect triggers exponential backoff reconnect', async () => {
    const authFetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, ticket: 'reconnect-ticket' })
      })
    );

    renderHook(() => useRealtimeSync({
      isLoggedIn: true,
      user: { id: 'u1' },
      authFetch
    }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(mockSockets.length).toBe(1);
    const socket = mockSockets[0];

    // Trigger genuine disconnect event
    act(() => {
      if (socket.onclose) socket.onclose({ code: 1006, reason: 'Abnormal closure' });
    });

    // 2s backoff timer
    expect(mockSockets.length).toBe(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2050);
    });

    // Verification: Reconnect attempted
    expect(mockSockets.length).toBe(2);
  });
});
