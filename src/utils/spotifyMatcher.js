/**
 * Tunely Spotify-to-JioSaavn Semantic Matching Engine
 * Pure deterministic candidate scoring & validation pipeline.
 * Zero external dependencies. Zero network calls.
 */

import { normalizeText, levenshteinSimilarity, diceCoefficient } from './textSimilarity';

/**
 * Extracts version descriptors and intent from a raw song title BEFORE normalization.
 * Distinguishes slowed, reverb, remix, live, acoustic, karaoke, instrumental, cover, etc.
 */
export function extractVersionMarkers(rawTitle = '') {
  const titleLower = (rawTitle || '').toLowerCase();

  const isSlowed = /\b(slowed|slowed down|slowed reverb|slow version|slow)\b/i.test(titleLower) &&
    !/\b(slow dance|slow hands|slow burn|slow down)\b/i.test(titleLower);
  const isSpedUp = /\b(speed up|sped up|speedup|spedup|fast version|nightcore)\b/i.test(titleLower);
  const isReverb = /\b(reverb|8d|3d|lofi|lo-fi)\b/i.test(titleLower);
  const isRemix = /\b(remix|club mix|extended mix|vip mix|dub mix|radio mix|remixed|dance mix|original mix)\b/i.test(titleLower);
  const isLive = /\b(live|live at|live from|concert|unplugged|orchestral|stripped)\b/i.test(titleLower);
  const isAcoustic = /\b(acoustic|acoustic version)\b/i.test(titleLower);
  const isKaraoke = /\b(karaoke|backing track|minus one|playback)\b/i.test(titleLower);
  const isCover = /\b(cover|tribute|made famous by|originally performed by|in the style of)\b/i.test(titleLower);
  const isInstrumental = /\b(instrumental|instrumental version)\b/i.test(titleLower);
  const isRadioEdit = /\b(radio edit|short edit|extended edit|clean version)\b/i.test(titleLower);

  const markers = [];
  if (isSlowed) markers.push('slowed');
  if (isSpedUp) markers.push('sped_up');
  if (isReverb) markers.push('reverb');
  if (isRemix) markers.push('remix');
  if (isLive) markers.push('live');
  if (isAcoustic) markers.push('acoustic');
  if (isKaraoke) markers.push('karaoke');
  if (isCover) markers.push('cover');
  if (isInstrumental) markers.push('instrumental');
  if (isRadioEdit) markers.push('radio_edit');

  return {
    isSlowed,
    isSpedUp,
    isReverb,
    isRemix,
    isLive,
    isAcoustic,
    isKaraoke,
    isCover,
    isInstrumental,
    isRadioEdit,
    hasVersionMarker: markers.length > 0,
    markers
  };
}

/**
 * Strips bracketed metadata, version tags, and featuring clauses to produce a clean base title.
 */
export function normalizeTitle(rawTitle = '') {
  if (!rawTitle) return '';
  let cleaned = rawTitle
    .replace(/\s*\([^)]*(slowed|sped|speed|remix|mix|live|concert|acoustic|karaoke|cover|instrumental|tribute|feat|featuring|ft|version|edit|official|audio|video|lyrics|deluxe|remaster|anniversary)[^)]*\)/gi, ' ')
    .replace(/\s*\[[^\]]*(slowed|sped|speed|remix|mix|live|concert|acoustic|karaoke|cover|instrumental|tribute|feat|featuring|ft|version|edit|official|audio|video|lyrics|deluxe|remaster|anniversary)[^\]]*\]/gi, ' ')
    .replace(/\s*-\s*(slowed|sped|speed|remix|mix|live|concert|acoustic|karaoke|cover|instrumental|tribute|radio edit|edit|from\s+["'].*["']).*$/gi, ' ')
    .replace(/\s*-\s*(single|ep|album|remastered|deluxe).*$/gi, ' ');

  return normalizeText(cleaned);
}

/**
 * Parses and extracts individual normalized artist tokens from an artist string or array.
 */
export function extractArtistTokens(artistInput) {
  if (!artistInput) return [];

  let rawList = [];
  if (Array.isArray(artistInput)) {
    rawList = artistInput.map(a => typeof a === 'string' ? a : (a?.name || ''));
  } else if (typeof artistInput === 'string') {
    // Split on common artist separators: commas, &, feat, featuring, ft., with, x, vs, /
    rawList = artistInput.split(/[,&/]|(?:\b(?:feat|featuring|ft|with|x|vs)\.?\b)/i);
  }

  const tokens = new Set();
  for (const item of rawList) {
    const norm = normalizeText(item);
    if (norm && norm.length >= 2) {
      tokens.add(norm);
    }
  }

  return Array.from(tokens);
}

/**
 * Calculates artist similarity and enforces HARD SAFETY RULES against wrong-artist mismatches.
 */
export function calculateArtistSimilarity(spotifyArtistInput, candidateTrack) {
  const spotifyTokens = extractArtistTokens(spotifyArtistInput);

  // Extract all artist tokens from JioSaavn candidate
  const candidatePrimary = candidateTrack?.artists?.primary || candidateTrack?.primaryArtists || [];
  const candidateAll = candidateTrack?.artists?.all || candidateTrack?.allArtists || [];
  const candidateRawStr = typeof candidateTrack?.artist === 'string' ? candidateTrack.artist : '';

  const candidateTokens = new Set([
    ...extractArtistTokens(candidatePrimary),
    ...extractArtistTokens(candidateAll),
    ...extractArtistTokens(candidateRawStr)
  ]);
  const candidateTokenList = Array.from(candidateTokens);

  if (spotifyTokens.length === 0 || candidateTokenList.length === 0) {
    return {
      score: 15,
      passedGate: true,
      reason: 'Missing artist metadata; neutral pass'
    };
  }

  let bestMatchScore = 0;
  let exactMatchCount = 0;

  for (const sToken of spotifyTokens) {
    for (const cToken of candidateTokenList) {
      if (sToken === cToken) {
        exactMatchCount++;
        bestMatchScore = Math.max(bestMatchScore, 35);
      } else {
        // Check word-bounded sub-match for compound artist names
        const sWords = sToken.split(/\s+/);
        const cWords = cToken.split(/\s+/);

        // If whole word token matches and is significant (>= 3 chars)
        const commonWords = sWords.filter(w => w.length >= 3 && cWords.includes(w));
        if (commonWords.length > 0) {
          const ratio = (commonWords.length * 2) / (sWords.length + cWords.length);
          if (ratio >= 0.5) {
            bestMatchScore = Math.max(bestMatchScore, ratio * 30);
          }
        }

        // Fuzzy string similarity
        const sim = levenshteinSimilarity(sToken, cToken);
        if (sim >= 0.82) {
          bestMatchScore = Math.max(bestMatchScore, sim * 28);
        }
      }
    }
  }

  // HARD SAFETY GATE: If zero meaningful artist overlap exists, REJECT candidate.
  if (bestMatchScore < 14 && exactMatchCount === 0) {
    return {
      score: 0,
      passedGate: false,
      reason: `Zero artist overlap between Spotify [${spotifyTokens.join(', ')}] and Candidate [${candidateTokenList.join(', ')}]`
    };
  }

  return {
    score: Math.min(35, bestMatchScore),
    passedGate: true,
    exactMatchCount
  };
}

/**
 * Evaluates version compatibility between Spotify source track and JioSaavn candidate.
 * Applies HARD REJECTION when a standard track is matched with slowed, remix, live, or karaoke.
 */
export function calculateVersionCompatibility(spotifyRawTitle, candidateRawTitle) {
  const sVer = extractVersionMarkers(spotifyRawTitle);
  const cVer = extractVersionMarkers(candidateRawTitle);

  // 1. HARD DISQUALIFICATIONS for extreme version transformations
  // A. Karaoke / Instrumental / Cover / Tribute when Spotify is NOT explicitly that
  if ((cVer.isKaraoke || cVer.isCover || cVer.isInstrumental) && !(sVer.isKaraoke || sVer.isCover || sVer.isInstrumental)) {
    return {
      score: -70,
      passedGate: false,
      reason: 'Candidate is Karaoke/Instrumental/Cover but Spotify track is standard'
    };
  }

  // B. Slowed / Sped Up / Nightcore when Spotify is NOT that
  if ((cVer.isSlowed || cVer.isSpedUp) && !(sVer.isSlowed || sVer.isSpedUp)) {
    return {
      score: -60,
      passedGate: false,
      reason: 'Candidate is Slowed/SpedUp but Spotify track is standard'
    };
  }

  // C. Remix / Club Mix when Spotify is NOT a remix
  if (cVer.isRemix && !sVer.isRemix) {
    return {
      score: -45,
      passedGate: false,
      reason: 'Candidate is Remix but Spotify track is standard'
    };
  }

  // D. Live / Acoustic when Spotify is NOT Live / Acoustic
  if ((cVer.isLive || cVer.isAcoustic) && !(sVer.isLive || sVer.isAcoustic)) {
    return {
      score: -40,
      passedGate: false,
      reason: 'Candidate is Live/Acoustic but Spotify track is standard'
    };
  }

  // 2. Compatible Matches
  // Both are standard
  if (!sVer.hasVersionMarker && !cVer.hasVersionMarker) {
    return { score: 20, passedGate: true };
  }

  // Both share matching version intent (e.g. both are Live or both are Remix)
  const sharedMarkers = sVer.markers.filter(m => cVer.markers.includes(m));
  if (sharedMarkers.length > 0) {
    return { score: 20, passedGate: true, sharedMarkers };
  }

  // Spotify explicitly wanted a version, but candidate is standard
  if (sVer.hasVersionMarker && !cVer.hasVersionMarker) {
    return {
      score: 5,
      passedGate: false,
      reason: `Spotify requested version [${sVer.markers.join(', ')}] but candidate is standard`
    };
  }

  return { score: 10, passedGate: true };
}

/**
 * Calculates duration proximity score and enforces safety rules against catastrophic duration mismatch.
 */
export function calculateDurationScore(spotifyDurationMs, candidateDurationSec) {
  if (!spotifyDurationMs || !candidateDurationSec) {
    return { score: 5, passedGate: true, deltaSec: null };
  }

  const sSec = Math.round(Number(spotifyDurationMs) / 1000);
  const cSec = Math.round(Number(candidateDurationSec));
  if (isNaN(sSec) || isNaN(cSec) || sSec <= 0 || cSec <= 0) {
    return { score: 5, passedGate: true, deltaSec: null };
  }

  const deltaSec = Math.abs(sSec - cSec);

  // HARD SAFETY GATE: Duration delta > 60 seconds is a catastrophic mismatch
  if (deltaSec > 60) {
    return {
      score: -35,
      passedGate: false,
      deltaSec,
      reason: `Catastrophic duration mismatch: Spotify ${sSec}s vs Candidate ${cSec}s (delta: ${deltaSec}s)`
    };
  }

  if (deltaSec <= 3) return { score: 10, passedGate: true, deltaSec };
  if (deltaSec <= 8) return { score: 8, passedGate: true, deltaSec };
  if (deltaSec <= 15) return { score: 5, passedGate: true, deltaSec };
  if (deltaSec <= 30) return { score: 2, passedGate: true, deltaSec };

  return { score: -15, passedGate: true, deltaSec };
}

/**
 * Scores a single JioSaavn candidate against a Spotify source track.
 * Returns { score, eligible, details, passedGates }.
 */
export function scoreSpotifyCandidate(spotifyTrack, candidate) {
  if (!spotifyTrack || !candidate) {
    return { score: 0, eligible: false, reason: 'Invalid input' };
  }

  const sRawTitle = spotifyTrack.title || spotifyTrack.name || '';
  const sArtist = spotifyTrack.artist || spotifyTrack.artists || '';
  const cRawTitle = candidate.name || candidate.title || '';

  // 1. Version Analysis (BEFORE title normalization)
  const versionEval = calculateVersionCompatibility(sRawTitle, cRawTitle);

  // 2. Artist Evaluation & Safety Gate
  const artistEval = calculateArtistSimilarity(sArtist, candidate);

  // 3. Duration Evaluation & Safety Gate
  const durationEval = calculateDurationScore(spotifyTrack.duration_ms || spotifyTrack.duration, candidate.duration);

  // HARD REJECTION GATE: If any critical gate failed, candidate is immediately ineligible
  if (!versionEval.passedGate || !artistEval.passedGate || !durationEval.passedGate) {
    return {
      score: 0,
      eligible: false,
      reason: versionEval.reason || artistEval.reason || durationEval.reason,
      details: { versionEval, artistEval, durationEval }
    };
  }

  // 4. Base Title Similarity
  const sBaseTitle = normalizeTitle(sRawTitle);
  const cBaseTitle = normalizeTitle(cRawTitle);

  let titleScore = 0;
  if (sBaseTitle === cBaseTitle) {
    titleScore = 35;
  } else {
    const levSim = levenshteinSimilarity(sBaseTitle, cBaseTitle);
    const diceSim = diceCoefficient(sBaseTitle, cBaseTitle);
    const combinedSim = 0.6 * levSim + 0.4 * diceSim;
    if (combinedSim >= 0.70) {
      titleScore = combinedSim * 35;
    } else {
      // Title mismatch
      return {
        score: 0,
        eligible: false,
        reason: `Title mismatch: Spotify "${sBaseTitle}" vs Candidate "${cBaseTitle}" (sim: ${combinedSim.toFixed(2)})`
      };
    }
  }

  // 5. Album Bonus (0..5 pts)
  let albumBonus = 0;
  const sAlbum = normalizeText(spotifyTrack.album?.name || spotifyTrack.album || '');
  const cAlbum = normalizeText(candidate.album?.name || candidate.album || '');
  if (sAlbum && cAlbum && (sAlbum === cAlbum || levenshteinSimilarity(sAlbum, cAlbum) >= 0.85)) {
    albumBonus = 5;
  }

  const totalScore = Math.max(0, Math.min(100,
    titleScore + artistEval.score + versionEval.score + durationEval.score + albumBonus
  ));

  return {
    score: totalScore,
    eligible: true,
    details: {
      titleScore,
      artistScore: artistEval.score,
      versionScore: versionEval.score,
      durationScore: durationEval.score,
      albumBonus,
      deltaSec: durationEval.deltaSec
    }
  };
}

/**
 * Evaluates a list of JioSaavn candidates for a given Spotify track.
 * Selects the single best candidate above the confidence threshold,
 * enforcing candidate score margin rules to prevent ambiguous imports.
 */
export function findBestCandidateMatch(spotifyTrack, candidates = []) {
  if (!spotifyTrack || !Array.isArray(candidates) || candidates.length === 0) {
    return {
      match: null,
      status: 'unmatched',
      reason: 'No candidates provided'
    };
  }

  const HIGH_CONFIDENCE_THRESHOLD = 80.0;
  const MEDIUM_CONFIDENCE_THRESHOLD = 65.0;
  const MIN_MARGIN_THRESHOLD = 8.0;

  const scoredCandidates = [];

  for (const candidate of candidates) {
    if (!candidate || !candidate.id) continue;
    const result = scoreSpotifyCandidate(spotifyTrack, candidate);
    if (result.eligible && result.score >= MEDIUM_CONFIDENCE_THRESHOLD) {
      scoredCandidates.push({
        candidate,
        score: result.score,
        details: result.details
      });
    }
  }

  if (scoredCandidates.length === 0) {
    return {
      match: null,
      status: 'unmatched',
      reason: 'No candidate satisfied minimum confidence and safety rules'
    };
  }

  // Sort by score descending
  scoredCandidates.sort((a, b) => b.score - a.score);

  const top = scoredCandidates[0];

  // If only 1 candidate or top candidate is high confidence
  if (scoredCandidates.length === 1) {
    if (top.score >= MEDIUM_CONFIDENCE_THRESHOLD) {
      return {
        match: top.candidate,
        status: 'matched',
        score: top.score,
        confidence: top.score >= HIGH_CONFIDENCE_THRESHOLD ? 'high' : 'medium'
      };
    }
  }

  const second = scoredCandidates[1];
  const margin = top.score - second.score;

  // Margin Check:
  // If top 2 candidates are nearly tied (< 8 pts difference), check if they are identical recordings (duplicates)
  if (margin < MIN_MARGIN_THRESHOLD) {
    const topTitle = normalizeTitle(top.candidate.name || '');
    const secTitle = normalizeTitle(second.candidate.name || '');
    const topArt = extractArtistTokens(top.candidate.artists?.primary || top.candidate.artist || '')[0];
    const secArt = extractArtistTokens(second.candidate.artists?.primary || second.candidate.artist || '')[0];

    const isDuplicateRecording = topTitle === secTitle && topArt === secArt;
    if (!isDuplicateRecording && top.score < HIGH_CONFIDENCE_THRESHOLD) {
      return {
        match: null,
        status: 'ambiguous',
        reason: `Ambiguous match between top candidate "${top.candidate.name}" (${top.score.toFixed(1)}) and "${second.candidate.name}" (${second.score.toFixed(1)})`
      };
    }
  }

  return {
    match: top.candidate,
    status: 'matched',
    score: top.score,
    confidence: top.score >= HIGH_CONFIDENCE_THRESHOLD ? 'high' : 'medium',
    margin
  };
}
