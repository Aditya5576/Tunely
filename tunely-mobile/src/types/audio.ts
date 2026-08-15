import { Track } from './music';
import { LyricsData } from './lyrics';

export type LoopMode = 'none' | 'all' | 'one';
export type AudioQuality = '96kbps' | '160kbps' | '320kbps';

export interface Queue {
  tracks: Track[];
  currentIndex: number;
}

export interface AudioState {
  isPlaying: boolean;
  currentTrack: Track | null;
  currentTime: number;
  duration: number;
  volume: number;
  loopMode: LoopMode;
  isShuffle: boolean;
  audioQuality: AudioQuality;
  isLoadingTrack: boolean;
  recentlyPlayed: Track[];
  lyrics: LyricsData | null;
  isLoadingLyrics: boolean;
}
