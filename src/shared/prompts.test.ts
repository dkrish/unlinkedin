import { describe, it, expect } from 'vitest';
import { buildUserPrompt, SYSTEM_PROMPT } from './prompts';
import type { Settings } from './types';

const baseSettings: Settings = {
  humorMode: 'funny',
  translationStyle: 'honestly',
  outputLength: 'short',
};

describe('SYSTEM_PROMPT', () => {
  it('instructs model to return only JSON', () => {
    expect(SYSTEM_PROMPT).toContain('JSON');
  });

  it('forbids cruelty', () => {
    expect(SYSTEM_PROMPT.toLowerCase()).toContain('cruel');
  });

  it('forbids invented facts', () => {
    expect(SYSTEM_PROMPT.toLowerCase()).toMatch(/invent|fabricat|made.up/);
  });
});

describe('buildUserPrompt', () => {
  it('includes the post text verbatim', () => {
    const text = 'Thrilled to announce I am beginning a new chapter.';
    expect(buildUserPrompt(text, baseSettings)).toContain(text);
  });

  it('includes all three JSON schema keys', () => {
    const prompt = buildUserPrompt('test post content here', baseSettings);
    expect(prompt).toContain('"intent"');
    expect(prompt).toContain('"translation"');
    expect(prompt).toContain('"tone_score"');
  });

  it('produces different output for different humor modes', () => {
    const dry = buildUserPrompt('test', { ...baseSettings, humorMode: 'dry' });
    const savage = buildUserPrompt('test', { ...baseSettings, humorMode: 'savage-lite' });
    expect(dry).not.toBe(savage);
  });

  it('produces different output for different output lengths', () => {
    const oneliner = buildUserPrompt('test', { ...baseSettings, outputLength: 'one-liner' });
    const full = buildUserPrompt('test', { ...baseSettings, outputLength: 'full' });
    expect(oneliner).not.toBe(full);
  });

  it('produces different output for different translation styles', () => {
    const polite = buildUserPrompt('test', { ...baseSettings, translationStyle: 'politely' });
    const groupchat = buildUserPrompt('test', { ...baseSettings, translationStyle: 'group-chat' });
    expect(polite).not.toBe(groupchat);
  });
});
