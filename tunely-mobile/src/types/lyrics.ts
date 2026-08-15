export interface LyricLine {
  time: number; // in seconds
  text: string;
}

export interface LyricsData {
  lyrics?: string;
  lines?: LyricLine[];
  snippet?: string;
  isSynced?: boolean;
}
