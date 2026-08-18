import { render, act } from '@testing-library/react';
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest';
import { AudioProvider, useAudio } from './AudioContext';

// Mocks
const mockAuthFetch = vi.fn();
let mockAuthValue = {
  user: { id: 'u1', username: 'testuser', isGuest: false },
  token: 'test-token',
  isLoggedIn: true,
  isLoading: false,
  authFetch: mockAuthFetch
};

vi.mock('./AuthContext', () => ({
  useAuth: () => mockAuthValue
}));

vi.mock('../hooks/useRealtimeSync', () => ({
  useRealtimeSync: () => {}
}));

// Test consumer component
function TestConsumer({ onContext }) {
  const context = useAudio();
  if (onContext) onContext(context);
  return (
    <div>
      <span data-testid="current-track">{context.currentTrack?.name || 'none'}</span>
      <span data-testid="is-playing">{context.isPlaying ? 'playing' : 'paused'}</span>
      <span data-testid="queue-length">{context.queue.length}</span>
    </div>
  );
}

describe('AudioContext - Recently Played & Radio Unit Tests', () => {
  let mockFetch;
  let createdAudioInstances;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockAuthFetch.mockReset();
    createdAudioInstances = [];

    mockAuthValue = {
      user: { id: 'u1', username: 'testuser', isGuest: false },
      token: 'test-token',
      isLoggedIn: true,
      isLoading: false,
      authFetch: mockAuthFetch
    };

    // Default mock responses
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [] })
    });

    mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [] })
    });
    global.fetch = mockFetch;

    // Spy/Mock Audio instance creation so we can trigger HTML5 events on audioRef.current
    const NativeAudio = window.Audio;
    vi.spyOn(window, 'Audio').mockImplementation(function () {
      const audioInstance = new NativeAudio();
      audioInstance.play = vi.fn().mockResolvedValue();
      audioInstance.pause = vi.fn();
      audioInstance.load = vi.fn();
      createdAudioInstances.push(audioInstance);
      return audioInstance;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to get active audio instance used by AudioProvider
  const getAudioInstance = () => createdAudioInstances[0];

  // Helper to dispatch timeupdate tick
  const dispatchTimeUpdate = (audio, time) => {
    Object.defineProperty(audio, 'currentTime', { value: time, writable: true, configurable: true });
    audio.dispatchEvent(new Event('timeupdate'));
  };

  // ==========================================
  // SECTION A: 10-Second Active Listening Threshold
  // ==========================================
  describe('Recently Played — 10-Second Active Listening Threshold', () => {
    it('triggers POST /api/user/recently-played when played continuously for 10 seconds', async () => {
      let ctx;
      render(
        <AudioProvider>
          <TestConsumer onContext={(c) => { ctx = c; }} />
        </AudioProvider>
      );

      const track = { id: 'track-10s', name: 'Ten Sec Song' };

      await act(async () => {
        ctx.playTrack(track);
      });

      const audio = getAudioInstance();

      await act(async () => {
        for (let t = 0.5; t <= 10.5; t += 0.5) {
          dispatchTimeUpdate(audio, t);
        }
      });

      const recentlyPlayedPosts = mockAuthFetch.mock.calls.filter(
        c => c[0].includes('/api/user/recently-played') && c[1]?.method === 'POST'
      );

      expect(recentlyPlayedPosts.length).toBe(1);
      expect(JSON.parse(recentlyPlayedPosts[0][1].body)).toEqual({ song: track });
    });

    it('does NOT trigger POST if played for less than 10 seconds', async () => {
      let ctx;
      render(
        <AudioProvider>
          <TestConsumer onContext={(c) => { ctx = c; }} />
        </AudioProvider>
      );

      const track = { id: 'track-short', name: 'Short Song' };

      await act(async () => {
        ctx.playTrack(track);
      });

      const audio = getAudioInstance();

      await act(async () => {
        for (let t = 0.5; t <= 9.0; t += 0.5) {
          dispatchTimeUpdate(audio, t);
        }
      });

      const recentlyPlayedPosts = mockAuthFetch.mock.calls.filter(
        c => c[0].includes('/api/user/recently-played') && c[1]?.method === 'POST'
      );
      expect(recentlyPlayedPosts.length).toBe(0);
    });

    it('freezes listening accumulator while paused', async () => {
      let ctx;
      render(
        <AudioProvider>
          <TestConsumer onContext={(c) => { ctx = c; }} />
        </AudioProvider>
      );

      const track = { id: 'track-pause', name: 'Pause Song' };

      await act(async () => {
        ctx.playTrack(track);
      });

      const audio = getAudioInstance();

      // Play 5s
      await act(async () => {
        for (let t = 0.5; t <= 5.0; t += 0.5) {
          dispatchTimeUpdate(audio, t);
        }
      });

      // Pause audio (in HTML5 browser, pausing stops timeupdate events from firing)
      await act(async () => {
        audio.dispatchEvent(new Event('pause'));
      });

      // While paused, zero timeupdate events occur. Advance currentTime without timeupdate.
      Object.defineProperty(audio, 'currentTime', { value: 15.0, writable: true, configurable: true });

      const recentlyPlayedPosts = mockAuthFetch.mock.calls.filter(
        c => c[0].includes('/api/user/recently-played') && c[1]?.method === 'POST'
      );
      expect(recentlyPlayedPosts.length).toBe(0);
    });

    it('resumes accumulation seamlessly across pause/resume cycles', async () => {
      let ctx;
      render(
        <AudioProvider>
          <TestConsumer onContext={(c) => { ctx = c; }} />
        </AudioProvider>
      );

      const track = { id: 'track-resume', name: 'Resume Song' };

      await act(async () => {
        ctx.playTrack(track);
      });

      const audio = getAudioInstance();

      // 1. Play 5s
      await act(async () => {
        for (let t = 0.5; t <= 5.0; t += 0.5) {
          dispatchTimeUpdate(audio, t);
        }
      });

      // 2. Pause
      await act(async () => {
        audio.dispatchEvent(new Event('pause'));
      });

      // 3. Resume play
      await act(async () => {
        audio.dispatchEvent(new Event('play'));
      });

      // 4. Play remaining 5.5s (from t=5.5 to t=11.0)
      await act(async () => {
        for (let t = 5.5; t <= 11.0; t += 0.5) {
          dispatchTimeUpdate(audio, t);
        }
      });

      const recentlyPlayedPosts = mockAuthFetch.mock.calls.filter(
        c => c[0].includes('/api/user/recently-played') && c[1]?.method === 'POST'
      );
      expect(recentlyPlayedPosts.length).toBe(1);
      expect(JSON.parse(recentlyPlayedPosts[0][1].body)).toEqual({ song: track });
    });

    it('does NOT count scrub/seek jumps as listening time', async () => {
      let ctx;
      render(
        <AudioProvider>
          <TestConsumer onContext={(c) => { ctx = c; }} />
        </AudioProvider>
      );

      const track = { id: 'track-seek', name: 'Seek Song' };

      await act(async () => {
        ctx.playTrack(track);
      });

      const audio = getAudioInstance();

      // Play 2s
      await act(async () => {
        for (let t = 0.5; t <= 2.0; t += 0.5) {
          dispatchTimeUpdate(audio, t);
        }
      });

      // Scrub forward 30s
      await act(async () => {
        ctx.setTrackTime(32.0);
      });

      // Continuous timeupdate at 32.5s (delta 30.5s fail < 2.0s check)
      await act(async () => {
        dispatchTimeUpdate(audio, 32.5);
      });

      const recentlyPlayedPosts = mockAuthFetch.mock.calls.filter(
        c => c[0].includes('/api/user/recently-played') && c[1]?.method === 'POST'
      );
      expect(recentlyPlayedPosts.length).toBe(0);
    });

    it('resets accumulator when switching to a new track before 10s', async () => {
      let ctx;
      render(
        <AudioProvider>
          <TestConsumer onContext={(c) => { ctx = c; }} />
        </AudioProvider>
      );

      const track1 = { id: 'track-1', name: 'Track 1' };
      const track2 = { id: 'track-2', name: 'Track 2' };

      // Play Track 1 for 6s
      await act(async () => {
        ctx.playTrack(track1);
      });

      const audio = getAudioInstance();
      await act(async () => {
        for (let t = 0.5; t <= 6.0; t += 0.5) {
          dispatchTimeUpdate(audio, t);
        }
      });

      // Switch to Track 2
      await act(async () => {
        ctx.playTrack(track2);
      });

      // Play Track 2 for 4s
      await act(async () => {
        for (let t = 0.5; t <= 4.0; t += 0.5) {
          dispatchTimeUpdate(audio, t);
        }
      });

      const recentlyPlayedPosts = mockAuthFetch.mock.calls.filter(
        c => c[0].includes('/api/user/recently-played') && c[1]?.method === 'POST'
      );
      expect(recentlyPlayedPosts.length).toBe(0);
    });

    it('prevents POSTing the same track twice in one playback session', async () => {
      let ctx;
      render(
        <AudioProvider>
          <TestConsumer onContext={(c) => { ctx = c; }} />
        </AudioProvider>
      );

      const track = { id: 'track-once', name: 'Once Song' };

      await act(async () => {
        ctx.playTrack(track);
      });

      const audio = getAudioInstance();

      // Play 20s
      await act(async () => {
        for (let t = 0.5; t <= 20.0; t += 0.5) {
          dispatchTimeUpdate(audio, t);
        }
      });

      const recentlyPlayedPosts = mockAuthFetch.mock.calls.filter(
        c => c[0].includes('/api/user/recently-played') && c[1]?.method === 'POST'
      );
      expect(recentlyPlayedPosts.length).toBe(1);
    });
  });

  // ==========================================
  // SECTION B: Recently Played — Cloud / Local Merge
  // ==========================================
  describe('Recently Played — Cloud / Local Merge', () => {
    it('fetches cloud recently played for authenticated users on mount', async () => {
      const cloudData = [{ id: 'cloud-1', name: 'Cloud Song 1' }];
      mockAuthFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: cloudData })
      });

      let ctx;
      render(
        <AudioProvider>
          <TestConsumer onContext={(c) => { ctx = c; }} />
        </AudioProvider>
      );

      await act(async () => {});

      expect(mockAuthFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/user/recently-played')
      );
      expect(ctx.recentlyPlayed).toEqual(cloudData);
    });

    it('merges cloud history with local history, giving cloud priority and deduplicating by ID', async () => {
      localStorage.setItem('tunely_recently_played', JSON.stringify([
        { id: 'shared-1', name: 'Local Old Shared' },
        { id: 'local-only', name: 'Local Only Song' }
      ]));

      const cloudData = [{ id: 'shared-1', name: 'Cloud Fresh Shared' }];
      mockAuthFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: cloudData })
      });

      let ctx;
      render(
        <AudioProvider>
          <TestConsumer onContext={(c) => { ctx = c; }} />
        </AudioProvider>
      );

      await act(async () => {});

      expect(ctx.recentlyPlayed.length).toBe(2);
      expect(ctx.recentlyPlayed[0]).toEqual({ id: 'shared-1', name: 'Cloud Fresh Shared' });
      expect(ctx.recentlyPlayed[1]).toEqual({ id: 'local-only', name: 'Local Only Song' });
    });

    it('caps final merged history at 12 items', async () => {
      const cloudData = Array.from({ length: 10 }, (_, i) => ({ id: `cloud-${i}`, name: `Cloud ${i}` }));
      const localData = Array.from({ length: 10 }, (_, i) => ({ id: `local-${i}`, name: `Local ${i}` }));
      localStorage.setItem('tunely_recently_played', JSON.stringify(localData));

      mockAuthFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: cloudData })
      });

      let ctx;
      render(
        <AudioProvider>
          <TestConsumer onContext={(c) => { ctx = c; }} />
        </AudioProvider>
      );

      await act(async () => {});

      expect(ctx.recentlyPlayed.length).toBe(12);
    });

    it('preserves local history if cloud GET fails', async () => {
      const localData = [{ id: 'local-safe', name: 'Safe Local Song' }];
      localStorage.setItem('tunely_recently_played', JSON.stringify(localData));

      mockAuthFetch.mockRejectedValueOnce(new Error('Network error'));

      let ctx;
      render(
        <AudioProvider>
          <TestConsumer onContext={(c) => { ctx = c; }} />
        </AudioProvider>
      );

      await act(async () => {});

      expect(ctx.recentlyPlayed).toEqual(localData);
    });

    it('does NOT make cloud GET requests for guest users', async () => {
      mockAuthValue = {
        user: { isGuest: true },
        isLoggedIn: false,
        isLoading: false,
        authFetch: mockAuthFetch
      };

      render(
        <AudioProvider>
          <TestConsumer />
        </AudioProvider>
      );

      await act(async () => {});

      expect(mockAuthFetch).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // SECTION C: startRadio(seedTrack)
  // ==========================================
  describe('startRadio(seedTrack)', () => {
    it('requests /api/songs/{encodedSeedId}/suggestions?limit=20', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [{ id: 'rec-1', name: 'Rec 1' }]
        })
      });

      let ctx;
      render(
        <AudioProvider>
          <TestConsumer onContext={(c) => { ctx = c; }} />
        </AudioProvider>
      );

      const seedTrack = { id: 'seed-123', name: 'Seed Track' };
      await act(async () => {
        await ctx.startRadio(seedTrack);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/songs/seed-123/suggestions?limit=20')
      );
    });

    it('places the seed track at index 0 of queue and deduplicates recommendations', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            { id: 'seed-1', name: 'Seed Track Duplicate' },
            { id: 'rec-1', name: 'Rec 1' },
            { id: 'rec-1', name: 'Rec 1 Duplicate' },
            { id: 'rec-2', name: 'Rec 2' }
          ]
        })
      });

      let ctx;
      render(
        <AudioProvider>
          <TestConsumer onContext={(c) => { ctx = c; }} />
        </AudioProvider>
      );

      const seedTrack = { id: 'seed-1', name: 'Seed Track' };
      await act(async () => {
        await ctx.startRadio(seedTrack);
      });

      expect(ctx.queue.length).toBe(3);
      expect(ctx.queue[0]).toEqual(seedTrack);
      expect(ctx.queue[1].id).toBe('rec-1');
      expect(ctx.queue[2].id).toBe('rec-2');
      expect(ctx.currentIndex).toBe(0);
      expect(ctx.currentTrack).toEqual(seedTrack);
    });

    it('falls back to playing seedTrack when suggestions API returns empty data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] })
      });

      let ctx;
      render(
        <AudioProvider>
          <TestConsumer onContext={(c) => { ctx = c; }} />
        </AudioProvider>
      );

      const seedTrack = { id: 'seed-empty', name: 'Empty Seed' };
      await act(async () => {
        await ctx.startRadio(seedTrack);
      });

      expect(ctx.currentTrack).toEqual(seedTrack);
      expect(ctx.queue[0]).toEqual(seedTrack);
    });

    it('falls back to playing seedTrack on HTTP / API error without throwing', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Suggestions endpoint down'));

      let ctx;
      render(
        <AudioProvider>
          <TestConsumer onContext={(c) => { ctx = c; }} />
        </AudioProvider>
      );

      const seedTrack = { id: 'seed-err', name: 'Error Seed' };
      await act(async () => {
        await ctx.startRadio(seedTrack);
      });

      expect(ctx.currentTrack).toEqual(seedTrack);
    });

    it('executes ZERO network requests if seedTrack is missing or invalid', async () => {
      let ctx;
      render(
        <AudioProvider>
          <TestConsumer onContext={(c) => { ctx = c; }} />
        </AudioProvider>
      );

      await act(async () => {
        await ctx.startRadio(null);
        await ctx.startRadio({});
        await ctx.startRadio({ name: 'No ID' });
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('correctly URL encodes seed track IDs with special characters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] })
      });

      let ctx;
      render(
        <AudioProvider>
          <TestConsumer onContext={(c) => { ctx = c; }} />
        </AudioProvider>
      );

      const specialTrack = { id: 'song 123/special&key', name: 'Special Song' };
      await act(async () => {
        await ctx.startRadio(specialTrack);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/songs/song%20123%2Fspecial%26key/suggestions?limit=20')
      );
    });
  });
});
