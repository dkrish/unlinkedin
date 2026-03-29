import { describe, it, expect } from 'vitest';
import { parseTranslationResult } from './index';

describe('parseTranslationResult', () => {
  it('parses valid JSON with all fields', () => {
    const raw = JSON.stringify({
      intent: 'They got promoted.',
      translation: 'I got promoted.',
      tone_score: 8,
    });
    const result = parseTranslationResult(raw);
    expect(result.intent).toBe('They got promoted.');
    expect(result.translation).toBe('I got promoted.');
    expect(result.tone_score).toBe(8);
  });

  it('strips markdown code fences before parsing', () => {
    const raw = '```json\n{"intent":"a","translation":"b","tone_score":5}\n```';
    const result = parseTranslationResult(raw);
    expect(result.translation).toBe('b');
  });

  it('strips plain code fences without language tag', () => {
    const raw = '```\n{"intent":"a","translation":"b","tone_score":5}\n```';
    const result = parseTranslationResult(raw);
    expect(result.translation).toBe('b');
  });

  it('defaults tone_score to 5 when field is missing', () => {
    const raw = JSON.stringify({ intent: 'test intent', translation: 'plain English' });
    const result = parseTranslationResult(raw);
    expect(result.tone_score).toBe(5);
  });

  it('throws MALFORMED_RESPONSE for completely invalid JSON', () => {
    expect(() => parseTranslationResult('not json at all')).toThrow('MALFORMED_RESPONSE');
  });

  it('throws MALFORMED_RESPONSE if translation field is missing', () => {
    const raw = JSON.stringify({ intent: 'something', tone_score: 5 });
    expect(() => parseTranslationResult(raw)).toThrow('MALFORMED_RESPONSE');
  });

  it('throws MALFORMED_RESPONSE if intent field is missing', () => {
    const raw = JSON.stringify({ translation: 'something', tone_score: 5 });
    expect(() => parseTranslationResult(raw)).toThrow('MALFORMED_RESPONSE');
  });

  it('clamps tone_score to valid range', () => {
    const raw = JSON.stringify({ intent: 'a', translation: 'b', tone_score: 99 });
    const result = parseTranslationResult(raw);
    expect(result.tone_score).toBeLessThanOrEqual(10);
  });
});
