import { SELECTORS, MIN_POST_LENGTH, MAX_POST_LENGTH } from '../shared/constants';

export type ExtractionResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'too_short' | 'not_found' };

export function extractPostText(postEl: Element): ExtractionResult {
  tryExpandSeeMore(postEl);
  const text = readText(postEl);

  if (!text) return { ok: false, reason: 'not_found' };
  if (text.length < MIN_POST_LENGTH) return { ok: false, reason: 'too_short' };

  return { ok: true, text: text.slice(0, MAX_POST_LENGTH) };
}

function tryExpandSeeMore(postEl: Element): void {
  const btn = postEl.querySelector<HTMLButtonElement>(SELECTORS.SEE_MORE_BUTTON);
  if (btn) {
    try {
      btn.click();
    } catch {
      // If click fails, proceed with visible text — not a fatal error
    }
  }
}

function readText(postEl: Element): string {
  const primary = postEl.querySelector(SELECTORS.POST_TEXT_PRIMARY);
  if (primary?.textContent?.trim()) return primary.textContent.trim();

  const fallback = postEl.querySelector(SELECTORS.POST_TEXT_FALLBACK);
  if (fallback?.textContent?.trim()) return fallback.textContent.trim();

  return '';
}
