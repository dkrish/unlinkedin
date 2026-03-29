import { describe, it, expect } from 'vitest';
import { extractPostText } from './extractor';

// Helpers to build mock post DOM nodes
function makePost(options: {
  primaryText?: string;
  fallbackText?: string;
  hasSeeMoreBtn?: boolean;
}): Element {
  const post = document.createElement('div');

  if (options.primaryText !== undefined) {
    const span = document.createElement('span');
    span.className = 'feed-shared-update-v2__description';
    span.textContent = options.primaryText;
    post.appendChild(span);
  }

  if (options.fallbackText !== undefined) {
    const span = document.createElement('span');
    span.className = 'feed-shared-text';
    span.textContent = options.fallbackText;
    post.appendChild(span);
  }

  if (options.hasSeeMoreBtn) {
    const btn = document.createElement('button');
    btn.className = 'feed-shared-inline-show-more-text__button';
    btn.textContent = '…more';
    post.appendChild(btn);
  }

  return post;
}

const LONG_TEXT = 'I am humbled and honored to announce a new chapter in my professional journey. After five incredible years, I have decided to embrace change and step into an exciting new opportunity. ';

describe('extractPostText', () => {
  it('returns not_found when post has no text', () => {
    const result = extractPostText(document.createElement('div'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_found');
  });

  it('returns too_short for text under 80 characters', () => {
    const result = extractPostText(makePost({ primaryText: 'Short post.' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('too_short');
  });

  it('extracts text from the primary selector', () => {
    const result = extractPostText(makePost({ primaryText: LONG_TEXT }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.text).toBe(LONG_TEXT.trim());
  });

  it('falls back to secondary selector if primary is absent', () => {
    const result = extractPostText(makePost({ fallbackText: LONG_TEXT }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.text).toBe(LONG_TEXT.trim());
  });

  it('truncates text longer than 4000 characters', () => {
    const longText = 'x'.repeat(5000);
    const result = extractPostText(makePost({ primaryText: longText }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.text.length).toBe(4000);
  });

  it('does not error if see-more button click fails', () => {
    const post = makePost({ primaryText: LONG_TEXT, hasSeeMoreBtn: true });
    // Should not throw even if button behavior is a no-op in jsdom
    expect(() => extractPostText(post)).not.toThrow();
  });
});
