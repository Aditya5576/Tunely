import { describe, it, expect } from 'vitest';
import {
  extractVersionMarkers,
  normalizeTitle,
  extractArtistTokens,
  calculateArtistSimilarity,
  calculateVersionCompatibility,
  calculateDurationScore,
  scoreSpotifyCandidate,
  findBestCandidateMatch
} from './spotifyMatcher';

describe('Tunely Spotify Matcher — Pure Deterministic Unit & Regression Tests', () => {

  // 1. Exact title + exact artist + same duration => ACCEPT
  it('1. Exact title + exact artist + same duration results in high confidence match', () => {
    const spotify = {
      title: 'Kesariya',
      artist: 'Arijit Singh, Pritam',
      duration_ms: 268000,
      album: 'Brahmastra'
    };
    const candidate = {
      id: 'c1',
      name: 'Kesariya',
      artists: { primary: [{ name: 'Arijit Singh' }, { name: 'Pritam' }] },
      album: { name: 'Brahmastra' },
      duration: 268
    };

    const res = scoreSpotifyCandidate(spotify, candidate);
    expect(res.eligible).toBe(true);
    expect(res.score).toBeGreaterThanOrEqual(95);

    const matchRes = findBestCandidateMatch(spotify, [candidate]);
    expect(matchRes.status).toBe('matched');
    expect(matchRes.match.id).toBe('c1');
    expect(matchRes.confidence).toBe('high');
  });

  // 2. Exact title + wrong artist => REJECT
  it('2. Exact title + wrong artist is HARD REJECTED (e.g. sombr vs Kim Cesarion)', () => {
    const spotify = {
      title: 'undressed',
      artist: 'sombr',
      duration_ms: 194000
    };
    const candidate = {
      id: 'c_wrong_artist',
      name: 'Undressed',
      artists: { primary: [{ name: 'Kim Cesarion' }] },
      duration: 228
    };

    const res = scoreSpotifyCandidate(spotify, candidate);
    expect(res.eligible).toBe(false);
    expect(res.score).toBe(0);

    const matchRes = findBestCandidateMatch(spotify, [candidate]);
    expect(matchRes.status).toBe('unmatched');
    expect(matchRes.match).toBeNull();
  });

  // 3. Exact title + same artist + slowed candidate (Spotify standard) => REJECT
  it('3. Standard Spotify track vs Slowed candidate is HARD REJECTED', () => {
    const spotify = {
      title: 'Shinigami',
      artist: 'Kenshi Yonezu',
      duration_ms: 180000
    };
    const candidateSlowed = {
      id: 'c_slowed',
      name: 'Shinigami (Slowed + Reverb)',
      artists: { primary: [{ name: 'Kenshi Yonezu' }] },
      duration: 240
    };

    const res = scoreSpotifyCandidate(spotify, candidateSlowed);
    expect(res.eligible).toBe(false);
    expect(res.score).toBe(0);

    const matchRes = findBestCandidateMatch(spotify, [candidateSlowed]);
    expect(matchRes.status).toBe('unmatched');
  });

  // 4. Exact title + same artist + remix candidate (Spotify standard) => REJECT
  it('4. Standard Spotify track vs Remix candidate is HARD REJECTED', () => {
    const spotify = {
      title: 'Levitating',
      artist: 'Dua Lipa',
      duration_ms: 203000
    };
    const candidateRemix = {
      id: 'c_remix',
      name: 'Levitating (Club Remix)',
      artists: { primary: [{ name: 'Dua Lipa' }] },
      duration: 240
    };

    const res = scoreSpotifyCandidate(spotify, candidateRemix);
    expect(res.eligible).toBe(false);
    expect(res.score).toBe(0);
  });

  // 5. Exact title + same artist + karaoke => REJECT
  it('5. Standard Spotify track vs Karaoke candidate is HARD REJECTED', () => {
    const spotify = {
      title: 'Sabir Pak Ka Wakia',
      artist: 'Aslam Sabri',
      duration_ms: 310000
    };
    const candidateKaraoke = {
      id: 'c_karaoke',
      name: 'Sabir Pak Ka Wakia (Karaoke Track)',
      artists: { primary: [{ name: 'Aslam Sabri' }] },
      duration: 310
    };

    const res = scoreSpotifyCandidate(spotify, candidateKaraoke);
    expect(res.eligible).toBe(false);
    expect(res.score).toBe(0);
  });

  // 6. Exact title + same artist + cover => REJECT
  it('6. Standard Spotify track vs Cover candidate is HARD REJECTED', () => {
    const spotify = {
      title: 'Poly',
      artist: 'Thumpasaurus',
      duration_ms: 185000
    };
    const candidateCover = {
      id: 'c_cover',
      name: 'Poly (Tribute Cover Version)',
      artists: { primary: [{ name: 'Thumpasaurus' }] },
      duration: 185
    };

    const res = scoreSpotifyCandidate(spotify, candidateCover);
    expect(res.eligible).toBe(false);
    expect(res.score).toBe(0);
  });

  // 7. Exact title + same artist + live (Spotify standard) => REJECT
  it('7. Standard Spotify track vs Live candidate is HARD REJECTED', () => {
    const spotify = {
      title: 'Hotel California',
      artist: 'Eagles',
      duration_ms: 391000
    };
    const candidateLive = {
      id: 'c_live',
      name: 'Hotel California - Live On Air',
      artists: { primary: [{ name: 'Eagles' }] },
      duration: 420
    };

    const res = scoreSpotifyCandidate(spotify, candidateLive);
    expect(res.eligible).toBe(false);
    expect(res.score).toBe(0);
  });

  // 8. Spotify live + JioSaavn live => ACCEPT
  it('8. Live Spotify track vs Live JioSaavn candidate is ACCEPTED', () => {
    const spotify = {
      title: 'Hotel California (Live)',
      artist: 'Eagles',
      duration_ms: 430000
    };
    const candidateLive = {
      id: 'c_live_ok',
      name: 'Hotel California (Live at The Forum)',
      artists: { primary: [{ name: 'Eagles' }] },
      duration: 432
    };

    const res = scoreSpotifyCandidate(spotify, candidateLive);
    expect(res.eligible).toBe(true);
    expect(res.score).toBeGreaterThanOrEqual(80);
  });

  // 9. Spotify slowed + JioSaavn slowed => ACCEPT
  it('9. Slowed Spotify track vs Slowed JioSaavn candidate is ACCEPTED', () => {
    const spotify = {
      title: 'After Dark (Slowed)',
      artist: 'Mr.Kitty',
      duration_ms: 310000
    };
    const candidateSlowed = {
      id: 'c_slowed_ok',
      name: 'After Dark - Slowed Version',
      artists: { primary: [{ name: 'Mr.Kitty' }] },
      duration: 312
    };

    const res = scoreSpotifyCandidate(spotify, candidateSlowed);
    expect(res.eligible).toBe(true);
    expect(res.score).toBeGreaterThanOrEqual(80);
  });

  // 10. Spotify original + candidate with 90 sec duration difference => REJECT
  it('10. Catastrophic duration difference (>60s) is HARD REJECTED', () => {
    const spotify = {
      title: 'Short Song',
      artist: 'Artist One',
      duration_ms: 120000 // 2:00
    };
    const candidateLong = {
      id: 'c_long',
      name: 'Short Song',
      artists: { primary: [{ name: 'Artist One' }] },
      duration: 240 // 4:00 (120s delta)
    };

    const res = scoreSpotifyCandidate(spotify, candidateLong);
    expect(res.eligible).toBe(false);
    expect(res.score).toBe(0);
  });

  // 11. Spotify original 3:00 vs candidate original 3:02 => strong match
  it('11. Close duration match (delta <= 3s) receives full duration score', () => {
    const spotify = {
      title: 'Tum Hi Ho',
      artist: 'Arijit Singh',
      duration_ms: 180000 // 3:00
    };
    const candidate = {
      id: 'c_tumhiho',
      name: 'Tum Hi Ho',
      artists: { primary: [{ name: 'Arijit Singh' }] },
      duration: 182 // 3:02 (2s delta)
    };

    const res = scoreSpotifyCandidate(spotify, candidate);
    expect(res.eligible).toBe(true);
    expect(res.details.durationScore).toBe(10);
    expect(res.score).toBeGreaterThanOrEqual(95);
  });

  // 12. Candidate #0 wrong, candidate #1 correct => candidate #1 selected
  it('12. Candidate #0 wrong (slowed) and #1 correct -> candidate #1 is selected', () => {
    const spotify = {
      title: 'Shinigami',
      artist: 'Kenshi Yonezu',
      duration_ms: 180000
    };
    const candidates = [
      {
        id: 'wrong_c0',
        name: 'Shinigami (Slowed + Reverb)',
        artists: { primary: [{ name: 'Anime Lofi Beats' }] },
        duration: 240
      },
      {
        id: 'correct_c1',
        name: 'Shinigami',
        artists: { primary: [{ name: 'Kenshi Yonezu' }] },
        duration: 180
      }
    ];

    const matchRes = findBestCandidateMatch(spotify, candidates);
    expect(matchRes.status).toBe('matched');
    expect(matchRes.match.id).toBe('correct_c1');
    expect(matchRes.score).toBeGreaterThanOrEqual(95);
  });

  // 13. Two candidates nearly tied => ambiguous / SKIP
  it('13. Ambiguous tie between distinct conflicting candidates is safely SKIPPED', () => {
    const spotify = {
      title: 'Ambiguous Song',
      artist: 'Artist A',
      duration_ms: 200000
    };
    const candidates = [
      {
        id: 'c1',
        name: 'Ambiguous Song (Track 1)',
        artists: { primary: [{ name: 'Artist A' }] },
        duration: 215 // score around 70-75
      },
      {
        id: 'c2',
        name: 'Ambiguous Song (Track 2)',
        artists: { primary: [{ name: 'Artist A' }] },
        duration: 214 // nearly identical score, low margin
      }
    ];

    const matchRes = findBestCandidateMatch(spotify, candidates);
    // Should skip or mark ambiguous rather than guess
    expect(matchRes.match).toBeNull();
  });

  // 14. No valid candidates => SKIP
  it('14. No valid candidates returns unmatched', () => {
    const spotify = { title: 'Unknown Indie Song', artist: 'Unknown Underground Artist' };
    const matchRes = findBestCandidateMatch(spotify, []);
    expect(matchRes.status).toBe('unmatched');
    expect(matchRes.match).toBeNull();
  });

  // 15. Artist "DJ A" vs "DJ ABC" => must not produce false positive
  it('15. "DJ A" vs "DJ ABC" does not false positive match', () => {
    const spotify = {
      title: 'Beat Drop',
      artist: 'DJ A',
      duration_ms: 180000
    };
    const candidate = {
      id: 'c_abc',
      name: 'Beat Drop',
      artists: { primary: [{ name: 'DJ ABC' }] },
      duration: 180
    };

    const res = scoreSpotifyCandidate(spotify, candidate);
    expect(res.eligible).toBe(false);
    expect(res.score).toBe(0);
  });

  // 16. feat / featuring / &, punctuation variations => correctly handled
  it('16. Handled featuring and punctuation variations seamlessly', () => {
    const spotify = {
      title: 'Calm Down (feat. Selena Gomez)',
      artist: 'Rema & Selena Gomez',
      duration_ms: 239000
    };
    const candidate = {
      id: 'c_calmdown',
      name: 'Calm Down',
      artists: { primary: [{ name: 'Rema' }, { name: 'Selena Gomez' }] },
      duration: 239
    };

    const res = scoreSpotifyCandidate(spotify, candidate);
    expect(res.eligible).toBe(true);
    expect(res.score).toBeGreaterThanOrEqual(90);
  });

  // 17. Unicode / accents => correctly normalized
  it('17. Unicode accents are normalized (e.g. MONTAGEM DELÍRIO)', () => {
    const spotify = {
      title: 'MONTAGEM DELÍRIO',
      artist: 'DJ Holanda',
      duration_ms: 130000
    };
    const candidate = {
      id: 'c_delirio',
      name: 'Montagem Delirio',
      artists: { primary: [{ name: 'DJ Holanda' }] },
      duration: 130
    };

    const res = scoreSpotifyCandidate(spotify, candidate);
    expect(res.eligible).toBe(true);
    expect(res.score).toBeGreaterThanOrEqual(95);
  });

  // 18. "Song" vs "Song (Slowed + Reverb)" => version mismatch despite perfect base title
  it('18. "Song" vs "Song (Slowed + Reverb)" is rejected despite identical base title', () => {
    const spotify = { title: 'Dosti', artist: 'Amit Trivedi' };
    const candidate = {
      id: 'c_slow',
      name: 'Dosti (Slowed + Reverb)',
      artists: { primary: [{ name: 'Amit Trivedi' }] }
    };

    const res = scoreSpotifyCandidate(spotify, candidate);
    expect(res.eligible).toBe(false);
  });

  // 19. "Song - Live" vs "Song" => reject standard candidate when Live was requested
  it('19. "Song - Live" vs standard candidate is not accepted as live', () => {
    const spotify = {
      title: 'Comfortably Numb - Live',
      artist: 'Pink Floyd',
      duration_ms: 480000
    };
    const candidateStudio = {
      id: 'c_studio',
      name: 'Comfortably Numb',
      artists: { primary: [{ name: 'Pink Floyd' }] },
      duration: 380
    };

    const res = scoreSpotifyCandidate(spotify, candidateStudio);
    expect(res.eligible).toBe(false);
  });

  // 20. Duplicate search results => deterministic selection
  it('20. Duplicate search results yield deterministic top match', () => {
    const spotify = {
      title: 'Perfect',
      artist: 'Ed Sheeran',
      duration_ms: 263000
    };
    const candidates = [
      { id: 'c1', name: 'Perfect', artists: { primary: [{ name: 'Ed Sheeran' }] }, duration: 263 },
      { id: 'c2', name: 'Perfect', artists: { primary: [{ name: 'Ed Sheeran' }] }, duration: 263 }
    ];

    const matchRes = findBestCandidateMatch(spotify, candidates);
    expect(matchRes.status).toBe('matched');
    expect(matchRes.match.id).toBe('c1');
  });

  // 21. Realistic Production Fixtures
  describe('21. Production Bug Fixtures Verification', () => {
    it('Fixture: Shinigami', () => {
      const spotify = { title: 'Shinigami', artist: 'Kenshi Yonezu', duration_ms: 180000 };
      const pool = [
        { id: 'wrong_lofi', name: 'Shinigami (Slowed)', artists: { primary: [{ name: 'Anime Lofi' }] }, duration: 220 },
        { id: 'correct_kenshi', name: 'Shinigami', artists: { primary: [{ name: 'Kenshi Yonezu' }] }, duration: 180 },
        { id: 'wrong_karaoke', name: 'Shinigami (Karaoke)', artists: { primary: [{ name: 'Sing Along' }] }, duration: 180 }
      ];
      const match = findBestCandidateMatch(spotify, pool);
      expect(match.match.id).toBe('correct_kenshi');
    });

    it('Fixture: undressed', () => {
      const spotify = { title: 'undressed', artist: 'sombr', duration_ms: 194000 };
      const pool = [
        { id: 'wrong_kim', name: 'Undressed', artists: { primary: [{ name: 'Kim Cesarion' }] }, duration: 228 }
      ];
      const match = findBestCandidateMatch(spotify, pool);
      expect(match.match).toBeNull();
      expect(match.status).toBe('unmatched');
    });

    it('Fixture: Sabir Pak Ka Wakia', () => {
      const spotify = { title: 'Sabir Pak Ka Wakia', artist: 'Aslam Sabri', duration_ms: 310000 };
      const pool = [
        { id: 'wrong_inst', name: 'Sabir Pak Ka Wakia (Instrumental)', artists: { primary: [{ name: 'Aslam Sabri' }] }, duration: 310 },
        { id: 'correct_qawwali', name: 'Sabir Pak Ka Wakia', artists: { primary: [{ name: 'Aslam Sabri' }] }, duration: 310 }
      ];
      const match = findBestCandidateMatch(spotify, pool);
      expect(match.match.id).toBe('correct_qawwali');
    });

    it('Fixture: Poly', () => {
      const spotify = { title: 'Poly', artist: 'Thumpasaurus', duration_ms: 185000 };
      const pool = [
        { id: 'wrong_cover', name: 'Poly (Cover)', artists: { primary: [{ name: 'Cover Band' }] }, duration: 185 },
        { id: 'correct_poly', name: 'Poly', artists: { primary: [{ name: 'Thumpasaurus' }] }, duration: 185 }
      ];
      const match = findBestCandidateMatch(spotify, pool);
      expect(match.match.id).toBe('correct_poly');
    });

    it('Fixture: MONTAGEM DELÍRIO', () => {
      const spotify = { title: 'MONTAGEM DELÍRIO', artist: 'DJ Holanda', duration_ms: 130000 };
      const pool = [
        { id: 'wrong_super_slowed', name: 'MONTAGEM DELÍRIO (Super Slowed)', artists: { primary: [{ name: 'DJ Holanda' }] }, duration: 200 },
        { id: 'correct_funk', name: 'MONTAGEM DELÍRIO', artists: { primary: [{ name: 'DJ Holanda' }] }, duration: 130 }
      ];
      const match = findBestCandidateMatch(spotify, pool);
      expect(match.match.id).toBe('correct_funk');
    });
  });

  // 22. Spotify Embed NBSP & HTML Entity Handling
  describe('22. Spotify Embed NBSP & HTML Entity Sanitization', () => {
    it('correctly matches tracks when Spotify metadata contains non-breaking spaces (\u00a0)', () => {
      const spotify = {
        title: 'Dai Dai',
        artist: 'Shakira,\u00a0Burna Boy',
        duration_ms: 223448
      };
      const pool = [
        { id: 'c_karaoke', name: 'Dai Dai (Karaoke Version)', artists: { primary: [{ name: 'ZZang KARAOKE' }] }, duration: 226 },
        { id: 'c_official', name: 'Dai Dai', artists: { primary: [{ name: 'Shakira' }, { name: 'Burna Boy' }] }, duration: 224 }
      ];
      const match = findBestCandidateMatch(spotify, pool);
      expect(match.status).toBe('matched');
      expect(match.match.id).toBe('c_official');
    });

    it('correctly normalizes HTML entities (&amp;, &#39;, &quot;)', () => {
      const spotify = {
        title: 'Rock &amp; Roll',
        artist: 'Led Zeppelin',
        duration_ms: 220000
      };
      const pool = [
        { id: 'c_rock', name: 'Rock & Roll', artists: { primary: [{ name: 'Led Zeppelin' }] }, duration: 220 }
      ];
      const match = findBestCandidateMatch(spotify, pool);
      expect(match.status).toBe('matched');
      expect(match.match.id).toBe('c_rock');
    });
  });
});
