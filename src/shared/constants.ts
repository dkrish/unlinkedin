import type { Settings } from './types';

// Model configuration
export const MODEL = 'openai/gpt-4o-mini';
export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
export const MAX_OUTPUT_TOKENS = 400;

// Post text limits
export const MIN_POST_LENGTH = 80;
export const MAX_POST_LENGTH = 4000;

/**
 * LinkedIn DOM selectors.
 * NOTE: LinkedIn changes its DOM frequently. If the extension stops detecting posts,
 * update the selectors here first — this is the only file that needs changing.
 */
export const SELECTORS = {
  // Feed post containers — LinkedIn's current feed renders posts as direct div children
  // of [data-testid="mainFeed"]. The old data-urn and BEM class selectors no longer match.
  // If buttons stop appearing, open DevTools and run:
  //   document.querySelectorAll('[data-testid="mainFeed"] > div').length
  // Should return the number of visible feed posts.
  POST_CONTAINER: '[data-testid="mainFeed"] > div',
  // Primary post text — LinkedIn now uses data-testid="expandable-text-box"
  POST_TEXT_PRIMARY: '[data-testid="expandable-text-box"]',
  // Fallback text for reshares and alternate formats
  POST_TEXT_FALLBACK: '.feed-shared-text, .attributed-text-segment-list__content',
  // "...see more" expansion button — LinkedIn now uses data-testid="expandable-text-button"
  SEE_MORE_BUTTON: '[data-testid="expandable-text-button"]',
  // Post action bar (likes, comments) — we insert our button above this.
  // If not found, the button is appended to the post card instead.
  POST_ACTIONS_BAR: '.social-actions-bar, .feed-shared-social-action-bar, .feed-shared-footer',
} as const;

export const DEFAULTS: Settings = {
  humorMode: 'savage-lite',
  translationStyle: 'group-chat',
  outputLength: 'short',
};

// Attribute stamped on processed posts to prevent duplicate injection
export const INJECTED_ATTR = 'data-ul-injected';

// Prefix for translation card element IDs
export const CARD_ID_PREFIX = 'ul-card-';

// Brand accent color used in injected UI
export const BRAND_COLOR = '#7c3aed';
