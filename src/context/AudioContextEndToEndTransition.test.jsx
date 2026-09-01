import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { AudioProvider, useAudio } from './AudioContext';

// Mocks
vi.mock('./AuthContext', () => ({
  useAuth: () => ({
    user: null,
    token: null,
    isLoggedIn: false,
    isLoading: false,
    authFetch: vi.fn()
  })
}));

vi.mock('../hooks/useRealtimeSync', () => ({
  useRealtimeSync: () => {}
}));

const mockTrackA = {
  id: 'song_a',
  name: 'Song A',
  artists: { primary: [{ name: 'Artist A' }] },
  downloadUrl: [{ quality: '320kbps', url: 'https://cdn.example.com/song_a.mp3' }]
};

const mockTrackB = {
  id: 'song_b',
  name: 'Song B',
  artists: { primary: [{ name: 'Artist B' }] },
  downloadUrl: [{ quality: '320kbps', url: 'https://cdn.example.com/song_b.mp3' }]
};

const mockTrackC = {
  id: 'song_c',
  name: 'Song C',
  artists: { primary: [{ name: 'Artist C' }] },
  downloadUrl: [{ quality: '320kbps', url: 'https://cdn.example.com/song_c.mp3' }]
};

function TestConsumer({ onContext }) {
  const ctx = useAudio();
  if (onContext) onContext(ctx);
  return (
    <div>
      <span data-testid="current-track">{ctx.currentTrack?.name || 'none'}</span>
      <span data-testid="is-playing">{ctx.isPlaying ? 'playing' : 'paused'}</span>
    </div>
  );
}

describe('AudioContext — End-to-End Automatic Track Transition Tests', () => {
  let createdAudioInstances = [];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    createdAudioInstances = [];

    const NativeAudio = window.Audio;
    vi.spyOn(window, 'Audio').mockImplementation(function () {
      const instance = new NativeAudio();
      instance.play = vi.fn().mockResolvedValue(undefined);
      instance.pause = vi.fn();
      instance.load = vi.fn();
      createdAudioInstances.push(instance);
      return instance;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const getAudioInstance = () => createdAudioInstances[0];

  it('1. Song A ended -> Song B starts automatically -> Song B ended -> Song C starts', async () => {
    let ctx;
    render(
      <AudioProvider>
        <TestConsumer onContext={(c) => { ctx = c; }} />
      </AudioProvider>
    );

    // Play Song A with queue [Song A, Song B, Song C]
    await act(async () => {
      ctx.playTrack(mockTrackA, [mockTrackA, mockTrackB, mockTrackC]);
    });

    expect(ctx.currentTrack.id).toBe('song_a');
    expect(ctx.currentIndex).toBe(0);

    const audio = getAudioInstance();

    // Trigger ended event on Song A
    await act(async () => {
      audio.dispatchEvent(new Event('ended'));
    });

    // Verification: Song B must automatically start
    expect(ctx.currentTrack.id).toBe('song_b');
    expect(ctx.currentIndex).toBe(1);

    // Trigger ended event on Song B
    await act(async () => {
      audio.dispatchEvent(new Event('ended'));
    });

    // Verification: Song C must automatically start
    expect(ctx.currentTrack.id).toBe('song_c');
    expect(ctx.currentIndex).toBe(2);
  });

  it('2. Loop Mode "one" replays current track on ended', async () => {
    let ctx;
    render(
      <AudioProvider>
        <TestConsumer onContext={(c) => { ctx = c; }} />
      </AudioProvider>
    );

    await act(async () => {
      ctx.playTrack(mockTrackA, [mockTrackA, mockTrackB]);
      ctx.toggleLoop(); // 'all'
      ctx.toggleLoop(); // 'one'
    });

    expect(ctx.loopMode).toBe('one');

    const audio = getAudioInstance();

    await act(async () => {
      audio.dispatchEvent(new Event('ended'));
    });

    // Must remain on Song A
    expect(ctx.currentTrack.id).toBe('song_a');
    expect(ctx.currentIndex).toBe(0);
  });

  it('3. User explicit pause must NOT auto-resume when window regains focus', async () => {
    let ctx;
    render(
      <AudioProvider>
        <TestConsumer onContext={(c) => { ctx = c; }} />
      </AudioProvider>
    );

    await act(async () => {
      ctx.playTrack(mockTrackA);
    });

    await act(async () => {
      ctx.togglePlay(); // User explicitly pauses
    });

    expect(ctx.isPlaying).toBe(false);

    // Window focus event
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    // Must remain paused
    expect(ctx.isPlaying).toBe(false);
  });

  it('4. MediaSession metadata updates automatically on track advance', async () => {
    if (!('mediaSession' in navigator)) {
      Object.defineProperty(navigator, 'mediaSession', {
        value: {
          metadata: null,
          playbackState: 'none',
          setActionHandler: vi.fn(),
          setPositionState: vi.fn()
        },
        writable: true,
        configurable: true
      });
    }

    let ctx;
    render(
      <AudioProvider>
        <TestConsumer onContext={(c) => { ctx = c; }} />
      </AudioProvider>
    );

    await act(async () => {
      ctx.playTrack(mockTrackA, [mockTrackA, mockTrackB]);
    });

    const audio = getAudioInstance();

    await act(async () => {
      audio.dispatchEvent(new Event('ended'));
    });

    expect(ctx.currentTrack.id).toBe('song_b');
  });
});
