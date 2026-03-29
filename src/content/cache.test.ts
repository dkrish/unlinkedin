import { describe, it, expect, beforeEach } from 'vitest';
import { hashPost, getCached, setCached, hasCached, clearCache } from './cache';
import type { TranslationResult } from '../shared/types';

const sampleResult: TranslationResult = {
  intent: 'They got promoted.',
  translation: 'I got promoted.',
  tone_score: 7,
};

beforeEach(() => clearCache());

describe('hashPost', () => {
  it('returns the same hash for identical text', () => {
    expect(hashPost('hello world')).toBe(hashPost('hello world'));
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(hashPost('  Hello World  ')).toBe(hashPost('hello world'));
  });

  it('returns different hashes for different text', () => {
    expect(hashPost('hello')).not.toBe(hashPost('world'));
  });

  it('returns a non-empty hex string', () => {
    const hash = hashPost('test');
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });
});

describe('cache operations', () => {
  it('hasCached returns false for unknown hash', () => {
    expect(hasCached('unknown')).toBe(false);
  });

  it('getCached returns undefined for unknown hash', () => {
    expect(getCached('unknown')).toBeUndefined();
  });

  it('stores and retrieves a result', () => {
    setCached('abc', sampleResult);
    expect(getCached('abc')).toEqual(sampleResult);
    expect(hasCached('abc')).toBe(true);
  });

  it('clearCache removes all entries', () => {
    setCached('abc', sampleResult);
    clearCache();
    expect(hasCached('abc')).toBe(false);
  });

  it('stores different results under different hashes', () => {
    const other: TranslationResult = { intent: 'other', translation: 'other', tone_score: 3 };
    setCached('abc', sampleResult);
    setCached('def', other);
    expect(getCached('abc')).toEqual(sampleResult);
    expect(getCached('def')).toEqual(other);
  });
});
