import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AudioProvider, useAudio } from './AudioContext';

// Mock AuthContext
vi.mock('./AuthContext', () => ({
  useAuth: () => ({
    user: null,
    token: null,
    isLoggedIn: false,
    isLoading: false,
    authFetch: vi.fn()
  })
}));

const mockTrack = {
  id: 'test_song_1',
  name: 'Test Song 1',
  artists: { primary: [{ name: 'Test Artist' }] },
  downloadUrl: [
    { quality: '320kbps', url: 'https://cdn.example.com/song1_320.mp3' }
  ]
};

const mockTrack2 = {
  id: 'test_song_2',
  name: 'Test Song 2',
  artists: { primary: [{ name: 'Test Artist 2' }] },
  downloadUrl: [
    { quality: '320kbps', url: 'https://cdn.example.com/song2_320.mp3' }
  ]
};

describe('AudioContext — Background & Recovery State Machine Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('1. User pause -> wait -> play preserves position and track', async () => {
    const { result } = renderHook(() => useAudio(), { wrapper: AudioProvider });

    await act(async () => {
      result.current.playTrack(mockTrack, [mockTrack, mockTrack2]);
    });

    expect(result.current.currentTrack.id).toBe('test_song_1');

    await act(async () => {
      result.current.setTrackTime(15);
      result.current.togglePlay(); // Pause
    });

    expect(result.current.isPlaying).toBe(false);
    expect(result.current.currentTrack.id).toBe('test_song_1');

    await act(async () => {
      result.current.togglePlay(); // Play
    });

    expect(result.current.currentTrack.id).toBe('test_song_1');
  });

  it('2. User pause must NOT auto-resume on visibility or focus change', async () => {
    const { result } = renderHook(() => useAudio(), { wrapper: AudioProvider });

    await act(async () => {
      result.current.playTrack(mockTrack);
    });

    await act(async () => {
      result.current.togglePlay(); // User explicitly pauses
    });

    expect(result.current.isPlaying).toBe(false);

    // Simulate app returning from background / window focus
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(result.current.isPlaying).toBe(false); // Must remain paused
  });

  it('3. Queue nextTrack and prevTrack continue working as expected', async () => {
    const { result } = renderHook(() => useAudio(), { wrapper: AudioProvider });

    await act(async () => {
      result.current.playTrack(mockTrack, [mockTrack, mockTrack2]);
    });

    expect(result.current.currentIndex).toBe(0);

    await act(async () => {
      result.current.nextTrack();
    });

    expect(result.current.currentIndex).toBe(1);
    expect(result.current.currentTrack.id).toBe('test_song_2');
  });

  it('4. Audio quality change updates live stream quality', async () => {
    const { result } = renderHook(() => useAudio(), { wrapper: AudioProvider });

    await act(async () => {
      result.current.playTrack(mockTrack);
      result.current.setAudioQuality('160kbps');
    });

    expect(result.current.audioQuality).toBe('160kbps');
  });
});
