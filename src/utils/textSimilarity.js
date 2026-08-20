/**
 * Lightweight Text Similarity & Typo-Tolerance Utilities for Tunely
 * Zero external dependencies. Uses normalized Levenshtein distance,
 * Dice coefficient bigram matching, and token-based similarity.
 */

/**
 * Normalizes text for search matching:
 * - Converts to lowercase
 * - Strips diacritics / accents (NFD normalization)
 * - Replaces punctuation and special characters with spaces
 * - Collapses consecutive whitespace and trims
 */
export function normalizeText(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics/accents
    .replace(/[^\w\s]/g, ' ')       // replace punctuation with space
    .replace(/\s+/g, ' ')           // collapse spaces
    .trim();
}

/**
 * Computes Levenshtein edit distance between two strings.
 */
export function levenshteinDistance(a, b) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const lenA = a.length;
  const lenB = b.length;
  let prevRow = new Int32Array(lenB + 1);
  let currRow = new Int32Array(lenB + 1);

  for (let j = 0; j <= lenB; j++) prevRow[j] = j;

  for (let i = 1; i <= lenA; i++) {
    currRow[0] = i;
    const charA = a.charCodeAt(i - 1);
    for (let j = 1; j <= lenB; j++) {
      const cost = charA === b.charCodeAt(j - 1) ? 0 : 1;
      currRow[j] = Math.min(
        prevRow[j] + 1,       // deletion
        currRow[j - 1] + 1,   // insertion
        prevRow[j - 1] + cost // substitution
      );
    }
    const temp = prevRow;
    prevRow = currRow;
    currRow = temp;
  }

  return prevRow[lenB];
}

/**
 * Returns similarity between 0.0 (completely different) and 1.0 (identical).
 */
export function levenshteinSimilarity(a, b) {
  const normA = normalizeText(a);
  const normB = normalizeText(b);
  if (!normA && !normB) return 1.0;
  if (!normA || !normB) return 0.0;
  const maxLen = Math.max(normA.length, normB.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshteinDistance(normA, normB);
  return Math.max(0, 1.0 - dist / maxLen);
}

/**
 * Computes Sørensen-Dice coefficient (bigram similarity).
 */
export function diceCoefficient(a, b) {
  const normA = normalizeText(a);
  const normB = normalizeText(b);
  if (normA === normB) return 1.0;
  if (normA.length < 2 || normB.length < 2) return 0.0;

  const getBigrams = (str) => {
    const bigrams = new Map();
    for (let i = 0; i < str.length - 1; i++) {
      const bigram = str.substring(i, i + 2);
      bigrams.set(bigram, (bigrams.get(bigram) || 0) + 1);
    }
    return bigrams;
  };

  const bigramsA = getBigrams(normA);
  const bigramsB = getBigrams(normB);
  let intersection = 0;

  for (const [bigram, countA] of bigramsA.entries()) {
    if (bigramsB.has(bigram)) {
      intersection += Math.min(countA, bigramsB.get(bigram));
    }
  }

  const total = (normA.length - 1) + (normB.length - 1);
  return (2.0 * intersection) / total;
}

/**
 * Normalizes query for typo fallback attempts:
 * Collapses 3+ repeated characters ("Kesariyaaa" -> "Kesariya")
 * and strips trailing non-alphanumeric characters.
 */
export function normalizeQueryForFallback(query) {
  if (!query) return '';
  let cleaned = query.replace(/(.)\1{2,}/gi, '$1'); // collapse 3+ repeated chars to 1
  cleaned = normalizeText(cleaned);
  return cleaned;
}

/**
 * Calculates a comprehensive relevance score for a track given a search query.
 */
export function calculateTrackRelevanceScore(track, rawQuery) {
  if (!track || !rawQuery) return 0;

  const normQuery = normalizeText(rawQuery);
  if (!normQuery) return 0;

  const queryTokens = normQuery.split(/\s+/).filter(Boolean);
  const title = normalizeText(track.name || '');
  const primaryArtists = (track.artists?.primary || []).map(a => normalizeText(a.name)).join(' ');
  const allArtists = (track.artists?.all || []).map(a => normalizeText(a.name)).join(' ');
  const albumName = normalizeText(track.album?.name || '');
  const combined = `${title} ${primaryArtists} ${allArtists} ${albumName}`;

  let score = 0;

  // 1. Exact Match Boosts
  if (title === normQuery) score += 150;
  else if (title.startsWith(normQuery)) score += 90;
  else if (title.includes(normQuery)) score += 50;

  if (primaryArtists.includes(normQuery) || allArtists.includes(normQuery)) score += 70;
  else {
    // Check fuzzy artist match
    const artistSim = levenshteinSimilarity(normQuery, primaryArtists || allArtists);
    if (artistSim >= 0.65) score += artistSim * 60;
  }

  // 2. Token Matching & Similarity
  let matchedTokenCount = 0;
  let totalTokenSimilarity = 0;

  for (const token of queryTokens) {
    if (combined.includes(token)) {
      matchedTokenCount += 1;
      totalTokenSimilarity += 1.0;
    } else {
      // Check token-level fuzzy match against title & artist words
      const combinedWords = combined.split(/\s+/).filter(Boolean);
      let bestWordSim = 0;
      for (const word of combinedWords) {
        if (Math.abs(word.length - token.length) <= 2) {
          const sim = levenshteinSimilarity(token, word);
          if (sim > bestWordSim) bestWordSim = sim;
        }
      }
      if (bestWordSim >= 0.70) {
        matchedTokenCount += 0.8;
        totalTokenSimilarity += bestWordSim;
      }
    }
  }

  if (queryTokens.length > 0) {
    const tokenMatchRatio = matchedTokenCount / queryTokens.length;
    score += tokenMatchRatio * 80;
  }

  // 3. String-level Levenshtein & Dice similarity
  const titleLevSim = levenshteinSimilarity(normQuery, title);
  if (titleLevSim >= 0.65) score += titleLevSim * 40;

  const titleDiceSim = diceCoefficient(normQuery, title);
  if (titleDiceSim >= 0.50) score += titleDiceSim * 30;

  // 4. Popularity bonus
  const playCount = Number(track.playCount) || 0;
  if (playCount > 0) {
    score += Math.log10(playCount) * 5;
  }

  return score;
}

/**
 * Evaluates whether a "Did you mean..." suggestion should be shown.
 */
export function getDidYouMeanSuggestion(query, topTrack) {
  if (!query || !topTrack) return null;
  const normQuery = normalizeText(query);
  if (!normQuery || normQuery.length < 3) return null;

  const title = (topTrack.name || '').trim();
  const primaryArtist = topTrack.artists?.primary?.[0]?.name || '';
  const normTitle = normalizeText(title);

  // If query is already exact match, no suggestion needed
  if (normTitle === normQuery) return null;

  // Check title similarity
  const titleSim = levenshteinSimilarity(normQuery, normTitle);
  if (titleSim >= 0.70 && titleSim < 1.0) {
    return title;
  }

  // Check artist similarity
  if (primaryArtist) {
    const normArtist = normalizeText(primaryArtist);
    const artistSim = levenshteinSimilarity(normQuery, normArtist);
    if (artistSim >= 0.70 && artistSim < 1.0) {
      return primaryArtist;
    }
    
    // Check combined "Title - Artist"
    const combinedCandidate = `${title} ${primaryArtist}`;
    const normCombined = normalizeText(combinedCandidate);
    const combinedSim = levenshteinSimilarity(normQuery, normCombined);
    if (combinedSim >= 0.65 && combinedSim < 1.0) {
      return combinedCandidate;
    }
  }

  return null;
}
