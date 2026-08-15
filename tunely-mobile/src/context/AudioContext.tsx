import React, { createContext, useContext, useState } from 'react';
import { Track } from '../types/music';
import { LoopMode, AudioQuality, AudioState } from '../types/audio';
import { LyricsData } from '../types/lyrics';

export interface AudioContextType extends AudioState {
  playTrack: (track: Track, newQueue?: Track[]) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  skipNext: () => Promise<void>;
  skipPrevious: () => Promise<void>;
  seekTo: (positionSeconds: number) => Promise<void>;
  setVolume: (volume: number) => void;
  setLoopMode: (mode: LoopMode) => void;
  toggleShuffle: () => void;
  setAudioQuality: (quality: AudioQuality) => void;
  addToQueue: (track: Track) => void;
  clearQueue: () => void;
  fetchLyricsForTrack: (track: Track) => Promise<void>;
}

const AudioContext = createContext<AudioContextType | null>(null);

export const useAudio = (): AudioContextType => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolumeState] = useState<number>(0.8);
  const [loopMode, setLoopModeState] = useState<LoopMode>('none');
  const [isShuffle, setIsShuffleState] = useState<boolean>(false);
  const [audioQuality, setAudioQualityState] = useState<AudioQuality>('320kbps');
  const [isLoadingTrack, setIsLoadingTrack] = useState<boolean>(false);
  const [recentlyPlayed, setRecentlyPlayed] = useState<Track[]>([]);
  const [lyrics, setLyrics] = useState<LyricsData | null>(null);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState<boolean>(false);

  // Architecture placeholder functions for Phase 3/4 Native Audio Engine Integration
  const playTrack = async (track: Track, _newQueue?: Track[]) => {
    setCurrentTrack(track);
    setIsPlaying(true);
    // Native audio driver integration will be hooked in Phase 4
  };

  const togglePlayPause = async () => {
    setIsPlaying(prev => !prev);
  };

  const skipNext = async () => {};
  const skipPrevious = async () => {};
  const seekTo = async (positionSeconds: number) => {
    setCurrentTime(positionSeconds);
  };
  const setVolume = (v: number) => setVolumeState(v);
  const setLoopMode = (mode: LoopMode) => setLoopModeState(mode);
  const toggleShuffle = () => setIsShuffleState(prev => !prev);
  const setAudioQuality = (q: AudioQuality) => setAudioQualityState(q);
  const addToQueue = (_track: Track) => {};
  const clearQueue = () => {};
  const fetchLyricsForTrack = async (_track: Track) => {};

  return (
    <AudioContext.Provider
      value={{
        isPlaying,
        currentTrack,
        currentTime,
        duration,
        volume,
        loopMode,
        isShuffle,
        audioQuality,
        isLoadingTrack,
        recentlyPlayed,
        lyrics,
        isLoadingLyrics,
        playTrack,
        togglePlayPause,
        skipNext,
        skipPrevious,
        seekTo,
        setVolume,
        setLoopMode,
        toggleShuffle,
        setAudioQuality,
        addToQueue,
        clearQueue,
        fetchLyricsForTrack,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
};
