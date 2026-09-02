/**
 * Tunely Backend Spotify-to-JioSaavn Semantic Matching Engine
 * Pure deterministic candidate scoring & validation pipeline.
 * Zero external dependencies. Zero network calls.
 */

export function normalizeText(str: string): string {
  if (!str) return ''
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/[\u00a0]/g, ' ')      // replace non-breaking space with regular space
    .replace(/[^\w\s]/g, ' ')       // replace punctuation with space
    .replace(/\s+/g, ' ')           // collapse spaces
    .trim()
}

export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0
  if (!a) return b.length
  if (!b) return a.length

  const lenA = a.length
  const lenB = b.length
  let prevRow = new Int32Array(lenB + 1)
  let currRow = new Int32Array(lenB + 1)

  for (let j = 0; j <= lenB; j++) prevRow[j] = j

  for (let i = 1; i <= lenA; i++) {
    currRow[0] = i
    const charA = a.charCodeAt(i - 1)
    for (let j = 1; j <= lenB; j++) {
      const cost = charA === b.charCodeAt(j - 1) ? 0 : 1
      currRow[j] = Math.min(
        prevRow[j] + 1,
        currRow[j - 1] + 1,
        prevRow[j - 1] + cost
      )
    }
    const temp = prevRow
    prevRow = currRow
    currRow = temp
  }

  return prevRow[lenB]
}

export function levenshteinSimilarity(a: string, b: string): number {
  const normA = normalizeText(a)
  const normB = normalizeText(b)
  if (!normA && !normB) return 1.0
  if (!normA || !normB) return 0.0
  const maxLen = Math.max(normA.length, normB.length)
  if (maxLen === 0) return 1.0
  const dist = levenshteinDistance(normA, normB)
  return Math.max(0, 1.0 - dist / maxLen)
}

export function diceCoefficient(a: string, b: string): number {
  const normA = normalizeText(a)
  const normB = normalizeText(b)
  if (normA === normB) return 1.0
  if (normA.length < 2 || normB.length < 2) return 0.0

  const getBigrams = (str: string) => {
    const bigrams = new Map<string, number>()
    for (let i = 0; i < str.length - 1; i++) {
      const bigram = str.substring(i, i + 2)
      bigrams.set(bigram, (bigrams.get(bigram) || 0) + 1)
    }
    return bigrams
  }

  const bigramsA = getBigrams(normA)
  const bigramsB = getBigrams(normB)
  let intersection = 0

  for (const [bigram, countA] of bigramsA.entries()) {
    if (bigramsB.has(bigram)) {
      intersection += Math.min(countA, bigramsB.get(bigram)!)
    }
  }

  const total = (normA.length - 1) + (normB.length - 1)
  return (2.0 * intersection) / total
}

export interface VersionMarkers {
  isSlowed: boolean
  isSpedUp: boolean
  isReverb: boolean
  isRemix: boolean
  isLive: boolean
  isAcoustic: boolean
  isKaraoke: boolean
  isCover: boolean
  isInstrumental: boolean
  isRadioEdit: boolean
  hasVersionMarker: boolean
  markers: string[]
}

export function extractVersionMarkers(rawTitle: string = ''): VersionMarkers {
  const titleLower = (rawTitle || '').toLowerCase()

  const isSlowed = /\b(slowed|slowed down|slowed reverb|slow version|slow)\b/i.test(titleLower) &&
    !/\b(slow dance|slow hands|slow burn|slow down)\b/i.test(titleLower)
  const isSpedUp = /\b(speed up|sped up|speedup|spedup|fast version|nightcore)\b/i.test(titleLower)
  const isReverb = /\b(reverb|8d|3d|lofi|lo-fi)\b/i.test(titleLower)
  const isRemix = /\b(remix|club mix|extended mix|vip mix|dub mix|radio mix|remixed|dance mix|original mix)\b/i.test(titleLower)
  const isLive = /\b(live|live at|live from|concert|unplugged|orchestral|stripped)\b/i.test(titleLower)
  const isAcoustic = /\b(acoustic|acoustic version)\b/i.test(titleLower)
  const isKaraoke = /\b(karaoke|backing track|minus one|playback)\b/i.test(titleLower)
  const isCover = /\b(cover|tribute|made famous by|originally performed by|in the style of)\b/i.test(titleLower)
  const isInstrumental = /\b(instrumental|instrumental version)\b/i.test(titleLower)
  const isRadioEdit = /\b(radio edit|short edit|extended edit|clean version)\b/i.test(titleLower)

  const markers: string[] = []
  if (isSlowed) markers.push('slowed')
  if (isSpedUp) markers.push('sped_up')
  if (isReverb) markers.push('reverb')
  if (isRemix) markers.push('remix')
  if (isLive) markers.push('live')
  if (isAcoustic) markers.push('acoustic')
  if (isKaraoke) markers.push('karaoke')
  if (isCover) markers.push('cover')
  if (isInstrumental) markers.push('instrumental')
  if (isRadioEdit) markers.push('radio_edit')

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
  }
}

export function normalizeTitle(rawTitle: string = ''): string {
  if (!rawTitle) return ''
  const cleaned = rawTitle
    .replace(/\s*\([^)]*(slowed|sped|speed|remix|mix|live|concert|acoustic|karaoke|cover|instrumental|tribute|feat|featuring|ft|version|edit|official|audio|video|lyrics|deluxe|remaster|anniversary)[^)]*\)/gi, ' ')
    .replace(/\s*\[[^\]]*(slowed|sped|speed|remix|mix|live|concert|acoustic|karaoke|cover|instrumental|tribute|feat|featuring|ft|version|edit|official|audio|video|lyrics|deluxe|remaster|anniversary)[^\]]*\]/gi, ' ')
    .replace(/\s*-\s*(slowed|sped|speed|remix|mix|live|concert|acoustic|karaoke|cover|instrumental|tribute|radio edit|edit|from\s+["'].*["']).*$/gi, ' ')
    .replace(/\s*-\s*(single|ep|album|remastered|deluxe).*$/gi, ' ')

  return normalizeText(cleaned)
}

export function extractArtistTokens(artistInput: any): string[] {
  if (!artistInput) return []

  let rawList: string[] = []
  if (Array.isArray(artistInput)) {
    rawList = artistInput.map(a => typeof a === 'string' ? a : (a?.name || ''))
  } else if (typeof artistInput === 'string') {
    rawList = artistInput.split(/[,&/]|(?:\b(?:feat|featuring|ft|with|x|vs)\.?\b)/i)
  }

  const tokens = new Set<string>()
  for (const item of rawList) {
    const norm = normalizeText(item)
    if (norm && norm.length >= 2) {
      tokens.add(norm)
    }
  }

  return Array.from(tokens)
}

export function calculateArtistSimilarity(spotifyArtistInput: any, candidateTrack: any) {
  const spotifyTokens = extractArtistTokens(spotifyArtistInput)

  const candidatePrimary = candidateTrack?.artists?.primary || candidateTrack?.primaryArtists || []
  const candidateAll = candidateTrack?.artists?.all || candidateTrack?.allArtists || []
  const candidateRawStr = typeof candidateTrack?.artist === 'string' ? candidateTrack.artist : ''

  const candidateTokens = new Set<string>([
    ...extractArtistTokens(candidatePrimary),
    ...extractArtistTokens(candidateAll),
    ...extractArtistTokens(candidateRawStr)
  ])
  const candidateTokenList = Array.from(candidateTokens)

  if (spotifyTokens.length === 0 || candidateTokenList.length === 0) {
    return {
      score: 15,
      passedGate: true,
      reason: 'Missing artist metadata; neutral pass'
    }
  }

  let bestMatchScore = 0
  let exactMatchCount = 0

  for (const sToken of spotifyTokens) {
    for (const cToken of candidateTokenList) {
      if (sToken === cToken) {
        exactMatchCount++
        bestMatchScore = Math.max(bestMatchScore, 35)
      } else {
        const sWords = sToken.split(/\s+/)
        const cWords = cToken.split(/\s+/)

        const commonWords = sWords.filter(w => w.length >= 3 && cWords.includes(w))
        if (commonWords.length > 0) {
          const ratio = (commonWords.length * 2) / (sWords.length + cWords.length)
          if (ratio >= 0.5) {
            bestMatchScore = Math.max(bestMatchScore, ratio * 30)
          }
        }

        const sim = levenshteinSimilarity(sToken, cToken)
        if (sim >= 0.82) {
          bestMatchScore = Math.max(bestMatchScore, sim * 28)
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
    }
  }

  return {
    score: Math.min(35, bestMatchScore),
    passedGate: true,
    exactMatchCount
  }
}

export function calculateVersionCompatibility(spotifyRawTitle: string, candidateRawTitle: string) {
  const sVer = extractVersionMarkers(spotifyRawTitle)
  const cVer = extractVersionMarkers(candidateRawTitle)

  // 1. HARD DISQUALIFICATIONS for extreme version transformations
  if ((cVer.isKaraoke || cVer.isCover || cVer.isInstrumental) && !(sVer.isKaraoke || sVer.isCover || sVer.isInstrumental)) {
    return {
      score: -70,
      passedGate: false,
      reason: 'Candidate is Karaoke/Instrumental/Cover but Spotify track is standard'
    }
  }

  if ((cVer.isSlowed || cVer.isSpedUp) && !(sVer.isSlowed || sVer.isSpedUp)) {
    return {
      score: -60,
      passedGate: false,
      reason: 'Candidate is Slowed/SpedUp but Spotify track is standard'
    }
  }

  if (cVer.isRemix && !sVer.isRemix) {
    return {
      score: -45,
      passedGate: false,
      reason: 'Candidate is Remix but Spotify track is standard'
    }
  }

  if ((cVer.isLive || cVer.isAcoustic) && !(sVer.isLive || sVer.isAcoustic)) {
    return {
      score: -40,
      passedGate: false,
      reason: 'Candidate is Live/Acoustic but Spotify track is standard'
    }
  }

  // 2. Compatible Matches
  if (!sVer.hasVersionMarker && !cVer.hasVersionMarker) {
    return { score: 20, passedGate: true }
  }

  const sharedMarkers = sVer.markers.filter(m => cVer.markers.includes(m))
  if (sharedMarkers.length > 0) {
    return { score: 20, passedGate: true, sharedMarkers }
  }

  if (sVer.hasVersionMarker && !cVer.hasVersionMarker) {
    return {
      score: 5,
      passedGate: false,
      reason: `Spotify requested version [${sVer.markers.join(', ')}] but candidate is standard`
    }
  }

  return { score: 10, passedGate: true }
}

export function calculateDurationScore(spotifyDurationMs: any, candidateDurationSec: any) {
  if (!spotifyDurationMs || !candidateDurationSec) {
    return { score: 5, passedGate: true, deltaSec: null }
  }

  const sSec = Math.round(Number(spotifyDurationMs) / 1000)
  const cSec = Math.round(Number(candidateDurationSec))
  if (isNaN(sSec) || isNaN(cSec) || sSec <= 0 || cSec <= 0) {
    return { score: 5, passedGate: true, deltaSec: null }
  }

  const deltaSec = Math.abs(sSec - cSec)

  if (deltaSec > 60) {
    return {
      score: -35,
      passedGate: false,
      deltaSec,
      reason: `Catastrophic duration mismatch: Spotify ${sSec}s vs Candidate ${cSec}s (delta: ${deltaSec}s)`
    }
  }

  if (deltaSec <= 3) return { score: 10, passedGate: true, deltaSec }
  if (deltaSec <= 8) return { score: 8, passedGate: true, deltaSec }
  if (deltaSec <= 15) return { score: 5, passedGate: true, deltaSec }
  if (deltaSec <= 30) return { score: 2, passedGate: true, deltaSec }

  return { score: -15, passedGate: true, deltaSec }
}

export function scoreSpotifyCandidate(spotifyTrack: any, candidate: any) {
  if (!spotifyTrack || !candidate) {
    return { score: 0, eligible: false, reason: 'Invalid input' }
  }

  const sRawTitle = spotifyTrack.title || spotifyTrack.name || ''
  const sArtist = spotifyTrack.artist || spotifyTrack.artists || ''
  const cRawTitle = candidate.name || candidate.title || ''

  const versionEval = calculateVersionCompatibility(sRawTitle, cRawTitle)
  const artistEval = calculateArtistSimilarity(sArtist, candidate)
  const durationEval = calculateDurationScore(spotifyTrack.duration_ms || spotifyTrack.duration, candidate.duration)

  if (!versionEval.passedGate || !artistEval.passedGate || !durationEval.passedGate) {
    return {
      score: 0,
      eligible: false,
      reason: versionEval.reason || artistEval.reason || durationEval.reason,
      details: { versionEval, artistEval, durationEval }
    }
  }

  const sBaseTitle = normalizeTitle(sRawTitle)
  const cBaseTitle = normalizeTitle(cRawTitle)

  let titleScore = 0
  if (sBaseTitle === cBaseTitle) {
    titleScore = 35
  } else {
    const levSim = levenshteinSimilarity(sBaseTitle, cBaseTitle)
    const diceSim = diceCoefficient(sBaseTitle, cBaseTitle)
    const combinedSim = 0.6 * levSim + 0.4 * diceSim
    if (combinedSim >= 0.70) {
      titleScore = combinedSim * 35
    } else {
      return {
        score: 0,
        eligible: false,
        reason: `Title mismatch: Spotify "${sBaseTitle}" vs Candidate "${cBaseTitle}" (sim: ${combinedSim.toFixed(2)})`
      }
    }
  }

  let albumBonus = 0
  const sAlbum = normalizeText(spotifyTrack.album?.name || spotifyTrack.album || '')
  const cAlbum = normalizeText(candidate.album?.name || candidate.album || '')
  if (sAlbum && cAlbum && (sAlbum === cAlbum || levenshteinSimilarity(sAlbum, cAlbum) >= 0.85)) {
    albumBonus = 5
  }

  const totalScore = Math.max(0, Math.min(100,
    titleScore + artistEval.score + versionEval.score + durationEval.score + albumBonus
  ))

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
  }
}

export function findBestCandidateMatch(spotifyTrack: any, candidates: any[] = []) {
  if (!spotifyTrack || !Array.isArray(candidates) || candidates.length === 0) {
    return {
      match: null,
      status: 'unmatched',
      reason: 'No candidates provided'
    }
  }

  const HIGH_CONFIDENCE_THRESHOLD = 80.0
  const MEDIUM_CONFIDENCE_THRESHOLD = 65.0
  const MIN_MARGIN_THRESHOLD = 8.0

  const scoredCandidates: any[] = []

  for (const candidate of candidates) {
    if (!candidate || !candidate.id) continue
    const result = scoreSpotifyCandidate(spotifyTrack, candidate)
    if (result.eligible && result.score >= MEDIUM_CONFIDENCE_THRESHOLD) {
      scoredCandidates.push({
        candidate,
        score: result.score,
        details: result.details
      })
    }
  }

  if (scoredCandidates.length === 0) {
    return {
      match: null,
      status: 'unmatched',
      reason: 'No candidate satisfied minimum confidence and safety rules'
    }
  }

  scoredCandidates.sort((a, b) => b.score - a.score)

  const top = scoredCandidates[0]

  if (scoredCandidates.length === 1) {
    if (top.score >= MEDIUM_CONFIDENCE_THRESHOLD) {
      return {
        match: top.candidate,
        status: 'matched',
        score: top.score,
        confidence: top.score >= HIGH_CONFIDENCE_THRESHOLD ? 'high' : 'medium'
      }
    }
  }

  const second = scoredCandidates[1]
  const margin = top.score - second.score

  if (margin < MIN_MARGIN_THRESHOLD) {
    const topTitle = normalizeTitle(top.candidate.name || '')
    const secTitle = normalizeTitle(second.candidate.name || '')
    const topArt = extractArtistTokens(top.candidate.artists?.primary || top.candidate.artist || '')[0]
    const secArt = extractArtistTokens(second.candidate.artists?.primary || second.candidate.artist || '')[0]

    const isDuplicateRecording = topTitle === secTitle && topArt === secArt
    if (!isDuplicateRecording && top.score < HIGH_CONFIDENCE_THRESHOLD) {
      return {
        match: null,
        status: 'ambiguous',
        reason: `Ambiguous match between top candidate "${top.candidate.name}" (${top.score.toFixed(1)}) and "${second.candidate.name}" (${second.score.toFixed(1)})`
      }
    }
  }

  return {
    match: top.candidate,
    status: 'matched',
    score: top.score,
    confidence: top.score >= HIGH_CONFIDENCE_THRESHOLD ? 'high' : 'medium',
    margin
  }
}
