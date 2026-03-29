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
  // Feed post containers — LinkedIn uses data-urn for activity identifiers.
  // If buttons stop appearing, open DevTools on the feed and run:
  //   document.querySelectorAll('[data-urn]').length
  //   document.querySelectorAll('.feed-shared-update-v2').length
  // Use whichever returns a count matching visible posts.
  POST_CONTAINER: '[data-urn], .feed-shared-update-v2',
  // Primary post text — covers standard text posts
  POST_TEXT_PRIMARY: '.feed-shared-update-v2__description, .feed-shared-text-view span[dir="ltr"]',
  // Fallback text for reshares and alternate formats
  POST_TEXT_FALLBACK: '.feed-shared-text, .attributed-text-segment-list__content',
  // "...see more" expansion button
  SEE_MORE_BUTTON: 'button.feed-shared-inline-show-more-text__button, button.see-more',
  // Post action bar (likes, comments) — we insert our button above this
  POST_ACTIONS_BAR: '.social-actions-bar, .feed-shared-social-action-bar, .feed-shared-footer',
} as const;

export const DEFAULTS: Settings = {
  humorMode: 'funny',
  translationStyle: 'honestly',
  outputLength: 'short',
};

// Attribute stamped on processed posts to prevent duplicate injection
export const INJECTED_ATTR = 'data-ul-injected';

// Prefix for translation card element IDs
export const CARD_ID_PREFIX = 'ul-card-';

// Brand accent color used in injected UI
export const BRAND_COLOR = '#7c3aed';
