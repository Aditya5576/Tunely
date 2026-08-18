import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import MainContent from './MainContent';

// Mocks
const mockStartRadio = vi.fn();
const mockPlayTrack = vi.fn();

let mockAudioState = {
  playTrack: mockPlayTrack,
  currentTrack: null,
  startRadio: mockStartRadio,
  likedSongsMetadata: [],
  toggleLikeTrack: vi.fn(),
  recentlyPlayed: [],
  isShuffle: false,
  toggleShuffle: vi.fn()
};

vi.mock('../context/AudioContext', () => ({
  useAudio: () => mockAudioState
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', username: 'testuser' },
    authFetch: vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: [] }) })
  })
}));

describe('MainContent Component Unit Tests — Recommended Radio Shelf', () => {
  let mockFetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAudioState = {
      playTrack: mockPlayTrack,
      currentTrack: null,
      startRadio: mockStartRadio,
      likedSongsMetadata: [],
      toggleLikeTrack: vi.fn(),
      recentlyPlayed: [],
      isShuffle: false,
      toggleShuffle: vi.fn()
    };

    mockFetch = vi.fn().mockImplementation(async (url) => {
      if (typeof url === 'string' && url.includes('/suggestions')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: [
              { id: 'rec-1', name: 'Recommended Track 1', artists: { primary: [{ name: 'Artist 1' }] } },
              { id: 'rec-2', name: 'Recommended Track 2', artists: { primary: [{ name: 'Artist 2' }] } }
            ]
          })
        };
      }
      return {
        ok: true,
        json: async () => ({ success: true, data: [] })
      };
    });
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses currentTrack as recommendation seed when available', async () => {
    mockAudioState.currentTrack = { id: 'current-1', name: 'Current Playing Song' };
    mockAudioState.recentlyPlayed = [{ id: 'recent-1', name: 'Recent Song' }];

    render(
      <MemoryRouter>
        <MainContent currentView="home" customPlaylists={[]} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/songs/current-1/suggestions?limit=10')
      );
    });
    expect(await screen.findByText(/Recommended Radio based on Current Playing Song/i)).toBeInTheDocument();
  });

  it('uses recentlyPlayed[0] as recommendation seed when currentTrack is missing', async () => {
    mockAudioState.currentTrack = null;
    mockAudioState.recentlyPlayed = [{ id: 'recent-1', name: 'Recent Song' }];

    render(
      <MemoryRouter>
        <MainContent currentView="home" customPlaylists={[]} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/songs/recent-1/suggestions?limit=10')
      );
    });
    expect(await screen.findByText(/Recommended Radio based on Recent Song/i)).toBeInTheDocument();
  });

  it('does NOT fetch recommendations or render shelf when neither currentTrack nor recentlyPlayed exists', async () => {
    mockAudioState.currentTrack = null;
    mockAudioState.recentlyPlayed = [];

    render(
      <MemoryRouter>
        <MainContent currentView="home" customPlaylists={[]} />
      </MemoryRouter>
    );

    await act(async () => {});

    const suggestionCalls = mockFetch.mock.calls.filter(c => c[0].includes('/suggestions'));
    expect(suggestionCalls.length).toBe(0);
    expect(screen.queryByText(/Recommended Radio based on/i)).not.toBeInTheDocument();
  });

  it('renders recommendation cards and excludes seed track from recommendations', async () => {
    mockAudioState.currentTrack = { id: 'seed-1', name: 'Seed Song' };
    mockFetch.mockImplementation(async (url) => {
      if (typeof url === 'string' && url.includes('/suggestions')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: [
              { id: 'seed-1', name: 'Seed Song Duplicate', artists: { primary: [{ name: 'Artist' }] } },
              { id: 'rec-1', name: 'Rec Song 1', artists: { primary: [{ name: 'Artist' }] } },
              { id: 'rec-2', name: 'Rec Song 2', artists: { primary: [{ name: 'Artist' }] } }
            ]
          })
        };
      }
      return { ok: true, json: async () => ({ success: true, data: [] }) };
    });

    render(
      <MemoryRouter>
        <MainContent currentView="home" customPlaylists={[]} />
      </MemoryRouter>
    );

    expect(await screen.findByText('Rec Song 1')).toBeInTheDocument();
    expect(await screen.findByText('Rec Song 2')).toBeInTheDocument();
    expect(screen.queryByText('Seed Song Duplicate')).not.toBeInTheDocument();
  });

  it('invokes startRadio(selectedTrack) when a recommendation card is clicked', async () => {
    mockAudioState.currentTrack = { id: 'seed-1', name: 'Seed Song' };

    render(
      <MemoryRouter>
        <MainContent currentView="home" customPlaylists={[]} />
      </MemoryRouter>
    );

    const recCard = await screen.findByText('Recommended Track 1');
    fireEvent.click(recCard);

    expect(mockStartRadio).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'rec-1', name: 'Recommended Track 1' })
    );
  });

  it('invokes startRadio(recommendedSeedTrack) when header Start Radio button is clicked', async () => {
    const seed = { id: 'seed-1', name: 'Seed Song' };
    mockAudioState.currentTrack = seed;

    render(
      <MemoryRouter>
        <MainContent currentView="home" customPlaylists={[]} />
      </MemoryRouter>
    );

    const headerBtn = await screen.findByTitle('Start Seed Song Radio Station');
    fireEvent.click(headerBtn);

    expect(mockStartRadio).toHaveBeenCalledWith(seed);
  });

  it('hides the shelf cleanly when suggestions API returns empty data', async () => {
    mockAudioState.currentTrack = { id: 'seed-empty', name: 'Empty Seed' };
    mockFetch.mockImplementation(async (url) => {
      if (typeof url === 'string' && url.includes('/suggestions')) {
        return { ok: true, json: async () => ({ success: true, data: [] }) };
      }
      return { ok: true, json: async () => ({ success: true, data: [] }) };
    });

    render(
      <MemoryRouter>
        <MainContent currentView="home" customPlaylists={[]} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/songs/seed-empty/suggestions'));
    });

    expect(screen.queryByText(/Recommended Radio based on/i)).not.toBeInTheDocument();
  });

  it('handles API network failure gracefully without crashing MainContent', async () => {
    mockAudioState.currentTrack = { id: 'seed-err', name: 'Error Seed' };
    mockFetch.mockImplementation(async (url) => {
      if (typeof url === 'string' && url.includes('/suggestions')) {
        throw new Error('Network error');
      }
      return { ok: true, json: async () => ({ success: true, data: [] }) };
    });

    render(
      <MemoryRouter>
        <MainContent currentView="home" customPlaylists={[]} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/songs/seed-err/suggestions'));
    });

    expect(screen.queryByText(/Recommended Radio based on/i)).not.toBeInTheDocument();
  });

  it('deduplicates recommendation cards by track ID', async () => {
    mockAudioState.currentTrack = { id: 'seed-1', name: 'Seed Song' };
    mockFetch.mockImplementation(async (url) => {
      if (typeof url === 'string' && url.includes('/suggestions')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: [
              { id: 'rec-dup', name: 'Duplicate Track', artists: { primary: [{ name: 'Artist' }] } },
              { id: 'rec-dup', name: 'Duplicate Track', artists: { primary: [{ name: 'Artist' }] } }
            ]
          })
        };
      }
      return { ok: true, json: async () => ({ success: true, data: [] }) };
    });

    render(
      <MemoryRouter>
        <MainContent currentView="home" customPlaylists={[]} />
      </MemoryRouter>
    );

    await screen.findByText('Duplicate Track');
    const cards = screen.getAllByText('Duplicate Track');
    expect(cards.length).toBe(1);
  });

  it('does NOT re-fetch recommendations on normal rerenders when seed track ID is unchanged', async () => {
    mockAudioState.currentTrack = { id: 'seed-static', name: 'Static Seed' };

    const { rerender } = render(
      <MemoryRouter>
        <MainContent currentView="home" customPlaylists={[]} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/songs/seed-static/suggestions'));
    });

    const initialFetchCount = mockFetch.mock.calls.filter(c => c[0].includes('/api/songs/seed-static/suggestions')).length;

    rerender(
      <MemoryRouter>
        <MainContent currentView="home" customPlaylists={[]} />
      </MemoryRouter>
    );

    await act(async () => {});

    const newFetchCount = mockFetch.mock.calls.filter(c => c[0].includes('/api/songs/seed-static/suggestions')).length;
    expect(newFetchCount).toBe(initialFetchCount);
  });
});
