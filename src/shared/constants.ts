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
  // Primary feed post container — LinkedIn stamps data-id on each post
  POST_CONTAINER: 'div[data-id]',
  // Main post text area
  POST_TEXT_PRIMARY: '.feed-shared-update-v2__description',
  // Fallback text selector for reshares and alternate post formats
  POST_TEXT_FALLBACK: '.feed-shared-text',
  // "...see more" expansion button
  SEE_MORE_BUTTON: 'button.feed-shared-inline-show-more-text__button',
  // Post action bar (likes, comments) — we insert above this
  POST_ACTIONS_BAR: '.social-actions-bar, .feed-shared-social-action-bar',
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
