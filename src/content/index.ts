import type { Settings } from '../shared/types';
import { SELECTORS, DEFAULTS } from '../shared/constants';
import { injectPost, setSettings } from './injector';

async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.sync.get([
    'humorMode',
    'translationStyle',
    'outputLength',
  ]) as Partial<Settings>;

  return {
    humorMode: stored.humorMode ?? DEFAULTS.humorMode,
    translationStyle: stored.translationStyle ?? DEFAULTS.translationStyle,
    outputLength: stored.outputLength ?? DEFAULTS.outputLength,
  };
}

function processPosts(): void {
  document.querySelectorAll<Element>(SELECTORS.POST_CONTAINER).forEach(injectPost);
}

async function init(): Promise<void> {
  const settings = await loadSettings();
  setSettings(settings);

  // Process posts already in the DOM
  processPosts();

  // Watch for new posts as the feed infinite-scrolls
  const observer = new MutationObserver((mutations) => {
    const hasNewNodes = mutations.some((m) => m.addedNodes.length > 0);
    if (hasNewNodes) processPosts();
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Re-read settings if the user changes them while the tab is open
  chrome.storage.sync.onChanged.addListener(() => {
    void loadSettings().then(setSettings);
  });
}

void init();
