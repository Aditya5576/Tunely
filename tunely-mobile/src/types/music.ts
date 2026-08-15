export interface Artist {
  id?: string;
  name: string;
  role?: string;
  image?: Array<{ quality: string; url: string }>;
  type?: string;
  url?: string;
}

export interface TrackImage {
  quality?: string;
  url: string;
}

export interface TrackDownloadUrl {
  quality: string; // '96kbps' | '160kbps' | '320kbps'
  url: string;
}

export interface TrackAlbum {
  id?: string;
  name: string;
  url?: string;
}

export interface Track {
  id: string;
  name: string;
  type?: string;
  album?: TrackAlbum;
  year?: string | number;
  releaseDate?: string;
  duration: number; // in seconds
  label?: string;
  primaryArtists?: string;
  featuredArtists?: string;
  explicitContent?: boolean;
  playCount?: number;
  language?: string;
  hasLyrics?: boolean;
  url?: string;
  copyright?: string;
  image: TrackImage[];
  downloadUrl: TrackDownloadUrl[];
  artists?: {
    primary?: Artist[];
    featured?: Artist[];
    all?: Artist[];
  };
  description?: string;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  type?: string;
  image?: TrackImage[];
  url?: string;
  songCount?: number;
  firstname?: string;
  lastname?: string;
  language?: string;
  songs?: Track[];
}

export interface CustomPlaylist {
  id: string;
  name: string;
  type: 'custom';
  songs: Track[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Album {
  id: string;
  name: string;
  description?: string;
  year?: string | number;
  releaseDate?: string;
  songCount?: number;
  artists?: {
    primary?: Artist[];
    featured?: Artist[];
    all?: Artist[];
  };
  image: TrackImage[];
  songs?: Track[];
}

export interface PodcastEpisode extends Track {
  releaseDate?: string;
  description?: string;
}

export interface PodcastShow {
  id: string;
  name: string;
  publisher?: string;
  type: 'podcast-show';
  image: TrackImage[];
  description: string;
  episodes: PodcastEpisode[];
}
