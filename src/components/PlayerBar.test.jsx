import { render, screen, fireEvent } from '@testing-library/react';
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest';
import PlayerBar from './PlayerBar';

// Mock useAudio hook from AudioContext
const mockStartRadio = vi.fn();
const mockTogglePlay = vi.fn();
const mockNextTrack = vi.fn();
const mockPrevTrack = vi.fn();

let mockAudioState = {
  isPlaying: false,
  currentTrack: { id: 's1', name: 'Kesariya', artists: { primary: [{ name: 'Arijit Singh' }] } },
  currentTime: 30,
  duration: 180,
  volume: 0.8,
  loopMode: 'none',
  isShuffle: false,
  isQueueVisible: false,
  isLyricsVisible: false,
  isLoadingTrack: false,
  togglePlay: mockTogglePlay,
  nextTrack: mockNextTrack,
  prevTrack: mockPrevTrack,
  setTrackTime: vi.fn(),
  setTrackVolume: vi.fn(),
  toggleLoop: vi.fn(),
  toggleShuffle: vi.fn(),
  setIsQueueVisible: vi.fn(),
  setIsLyricsVisible: vi.fn(),
  audioQuality: '320kbps',
  setAudioQuality: vi.fn(),
  sleepTimer: null,
  setSleepTimer: vi.fn(),
  sleepTimeLeft: null,
  likedSongs: [],
  toggleLikeTrack: vi.fn(),
  currentLyric: '',
  startRadio: mockStartRadio
};

vi.mock('../context/AudioContext', () => ({
  useAudio: () => mockAudioState
}));

describe('PlayerBar Component Unit Tests — Start Radio Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAudioState = {
      isPlaying: false,
      currentTrack: { id: 's1', name: 'Kesariya', artists: { primary: [{ name: 'Arijit Singh' }] } },
      currentTime: 30,
      duration: 180,
      volume: 0.8,
      loopMode: 'none',
      isShuffle: false,
      isQueueVisible: false,
      isLyricsVisible: false,
      isLoadingTrack: false,
      togglePlay: mockTogglePlay,
      nextTrack: mockNextTrack,
      prevTrack: mockPrevTrack,
      setTrackTime: vi.fn(),
      setTrackVolume: vi.fn(),
      toggleLoop: vi.fn(),
      toggleShuffle: vi.fn(),
      setIsQueueVisible: vi.fn(),
      setIsLyricsVisible: vi.fn(),
      audioQuality: '320kbps',
      setAudioQuality: vi.fn(),
      sleepTimer: null,
      setSleepTimer: vi.fn(),
      sleepTimeLeft: null,
      likedSongs: [],
      toggleLikeTrack: vi.fn(),
      currentLyric: '',
      startRadio: mockStartRadio
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders Desktop Start Radio button when currentTrack exists', () => {
    render(<PlayerBar />);
    const radioBtn = screen.getByRole('button', { name: /^start radio$/i });
    expect(radioBtn).toBeInTheDocument();
    expect(radioBtn).not.toBeDisabled();
  });

  it('invokes startRadio(currentTrack) when Desktop Start Radio button is clicked', () => {
    render(<PlayerBar />);
    const radioBtn = screen.getByRole('button', { name: /^start radio$/i });
    fireEvent.click(radioBtn);
    expect(mockStartRadio).toHaveBeenCalledWith(mockAudioState.currentTrack);
  });

  it('disables Start Radio button when currentTrack is null', () => {
    mockAudioState.currentTrack = null;
    render(<PlayerBar />);
    const radioBtn = screen.getByRole('button', { name: /^start radio$/i });
    expect(radioBtn).toBeDisabled();
  });

  it('disables Start Radio button while isLoadingTrack is true', () => {
    mockAudioState.isLoadingTrack = true;
    render(<PlayerBar />);
    const radioBtn = screen.getByRole('button', { name: /^start radio$/i });
    expect(radioBtn).toBeDisabled();
  });

  it('does NOT trigger startRadio when disabled button is clicked', () => {
    mockAudioState.currentTrack = null;
    render(<PlayerBar />);
    const radioBtn = screen.getByRole('button', { name: /^start radio$/i });
    fireEvent.click(radioBtn);
    expect(mockStartRadio).not.toHaveBeenCalled();
  });

  it('verifies play/pause and nextTrack controls continue working as expected', () => {
    render(<PlayerBar />);
    const playBtns = screen.getAllByTitle('Play');
    fireEvent.click(playBtns[0]);
    expect(mockTogglePlay).toHaveBeenCalled();

    const nextBtn = screen.getByTitle('Next Track');
    fireEvent.click(nextBtn);
    expect(mockNextTrack).toHaveBeenCalled();
  });
});
