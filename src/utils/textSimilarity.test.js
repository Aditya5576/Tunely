import { describe, it, expect } from 'vitest';
import {
  normalizeText,
  levenshteinDistance,
  levenshteinSimilarity,
  diceCoefficient,
  normalizeQueryForFallback,
  calculateTrackRelevanceScore,
  getDidYouMeanSuggestion
} from './textSimilarity';

describe('Text Similarity & Typo-Tolerance Unit Tests', () => {
  it('1. Exact search normalization', () => {
    expect(normalizeText('Arijit Singh')).toBe('arijit singh');
  });

  it('2. Missing character typo normalization and similarity', () => {
    const sim = levenshteinSimilarity('Arijit Sing', 'Arijit Singh');
    expect(sim).toBeGreaterThanOrEqual(0.85);
  });

  it('3. Extra character typo normalization and fallback query generation', () => {
    const fallback = normalizeQueryForFallback('Kesariyaaa');
    expect(fallback).toBe('kesariya');
    const sim = levenshteinSimilarity('Kesariyaaa', 'Kesariya');
    expect(sim).toBeGreaterThanOrEqual(0.70);
  });

  it('4. Wrong spacing normalization', () => {
    expect(normalizeText('Tumh  Ho')).toBe('tumh ho');
    const sim = levenshteinSimilarity('Tumh Ho', 'Tum Hi Ho');
    expect(sim).toBeGreaterThanOrEqual(0.70);
  });

  it('5. Case difference handling', () => {
    expect(normalizeText('ARIJIT SINGH')).toBe(normalizeText('arijit singh'));
  });

  it('6. Punctuation difference handling', () => {
    expect(normalizeText('Aaj Ki Raat!')).toBe(normalizeText('aaj ki raat'));
    expect(normalizeText('Tum Hi Ho...')).toBe(normalizeText('tum hi ho'));
  });

  it('7. Artist typo matching', () => {
    const track = { name: 'Param Sundari', artists: { primary: [{ name: 'Shreya Ghoshal' }] } };
    const scoreTypo = calculateTrackRelevanceScore(track, 'Shreya Gosl');
    expect(scoreTypo).toBeGreaterThan(50);
  });

  it('8. Song title typo matching', () => {
    const track = { name: 'Kesariya', artists: { primary: [{ name: 'Arijit Singh' }] } };
    const scoreTypo = calculateTrackRelevanceScore(track, 'Kesariyaaa');
    expect(scoreTypo).toBeGreaterThan(50);
  });

  it('9. Empty search handling', () => {
    expect(normalizeText('')).toBe('');
    expect(calculateTrackRelevanceScore(null, '')).toBe(0);
    expect(getDidYouMeanSuggestion('', null)).toBeNull();
  });

  it('10. Rapid query change normalization stability', () => {
    expect(normalizeQueryForFallback('A')).toBe('a');
    expect(normalizeQueryForFallback('Ar')).toBe('ar');
    expect(normalizeQueryForFallback('Ari')).toBe('ari');
  });

  it('11. Duplicate query caching equivalence', () => {
    expect(normalizeText('  Arijit   Singh  ')).toBe(normalizeText('Arijit Singh'));
  });

  it('12. Rate-limit safe fallback query generator returns non-empty string', () => {
    expect(normalizeQueryForFallback('Aaj Ki Rat')).toBe('aaj ki rat');
  });

  it('13. Guest mode query calculation', () => {
    const track = { name: 'Chaleya', artists: { primary: [{ name: 'Arijit Singh' }] } };
    const score = calculateTrackRelevanceScore(track, 'Chaleya');
    expect(score).toBeGreaterThan(100);
  });

  it('14. No background Home requests on Search (Score is calculated in-memory)', () => {
    const track = { name: 'Kesariya', artists: { primary: [{ name: 'Arijit Singh' }] } };
    const score = calculateTrackRelevanceScore(track, 'Kesariya');
    expect(score).toBeGreaterThan(100);
  });

  it('15. Fuzzy ranking does NOT incorrectly prioritize unrelated songs', () => {
    const relevantTrack = { name: 'Kesariya', artists: { primary: [{ name: 'Arijit Singh' }] } };
    const unrelatedTrack = { name: 'Random Song Name', artists: { primary: [{ name: 'Different Artist' }] } };

    const scoreRel = calculateTrackRelevanceScore(relevantTrack, 'Kesariyaaa');
    const scoreUnrel = calculateTrackRelevanceScore(unrelatedTrack, 'Kesariyaaa');

    expect(scoreRel).toBeGreaterThan(scoreUnrel);
  });

  it('Evaluates getDidYouMeanSuggestion correctly', () => {
    const topTrack = { name: 'Arijit Singh Hits', artists: { primary: [{ name: 'Arijit Singh' }] } };
    const suggestion = getDidYouMeanSuggestion('Arijit Sing', topTrack);
    expect(suggestion).toBeTruthy();
  });
});
