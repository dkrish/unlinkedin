import type { Settings, TranslateRequest, TranslateResponse } from '../shared/types';
import { SELECTORS, INJECTED_ATTR, DEFAULTS } from '../shared/constants';
import { extractPostText } from './extractor';
import { hashPost, getCached, setCached } from './cache';
import { createTriggerButton, setButtonLoading, upsertCard } from './ui';

let currentSettings: Settings = DEFAULTS;

export function setSettings(s: Settings): void {
  currentSettings = s;
}

/**
 * Injects the translate button into a LinkedIn post element.
 * Skips posts that have already been processed (data-ul-injected="true")
 * or that contain no extractable text.
 */
export function injectPost(postEl: Element): void {
  if (postEl.hasAttribute(INJECTED_ATTR)) return;

  // Quick pre-check: does this element have any text at all?
  // (Full extraction + see-more expansion happens at click time)
  const hasAnyText =
    postEl.querySelector(SELECTORS.POST_TEXT_PRIMARY)?.textContent?.trim() ||
    postEl.querySelector(SELECTORS.POST_TEXT_FALLBACK)?.textContent?.trim();

  if (!hasAnyText) return;

  postEl.setAttribute(INJECTED_ATTR, 'true');

  const container = document.createElement('div');
  container.className = 'ul-btn-container';
  Object.assign(container.style, { padding: '0 16px 8px' });

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let isLoading = false;

  const btn = createTriggerButton(() => {
    if (isLoading) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => void runTranslation(postEl, btn), 300);
  });

  container.appendChild(btn);

  const actionsBar = postEl.querySelector(SELECTORS.POST_ACTIONS_BAR);
  if (actionsBar) {
    actionsBar.before(container);
  } else {
    postEl.appendChild(container);
  }

  async function runTranslation(post: Element, triggerBtn: HTMLButtonElement): Promise<void> {
    isLoading = true;
    setButtonLoading(triggerBtn, true);

    // Extract at click time so "see more" has a chance to be expanded
    const extraction = extractPostText(post);

    if (!extraction.ok) {
      upsertCard(container, 'short', { status: 'too_short' });
      setButtonLoading(triggerBtn, false);
      isLoading = false;
      return;
    }

    const hash = hashPost(extraction.text);

    // Cache hit — render immediately
    const cached = getCached(hash);
    if (cached) {
      upsertCard(container, hash, { status: 'result', data: cached });
      setButtonLoading(triggerBtn, false);
      isLoading = false;
      return;
    }

    upsertCard(container, hash, { status: 'loading' });

    const request: TranslateRequest = {
      type: 'TRANSLATE',
      payload: { text: extraction.text, settings: currentSettings },
    };

    try {
      const response = await sendMessage(request);

      if (response.type === 'TRANSLATION_RESULT') {
        setCached(hash, response.payload);
        upsertCard(container, hash, { status: 'result', data: response.payload });
      } else {
        const msg = response.payload.message;
        if (msg === 'NO_API_KEY') {
          upsertCard(container, hash, { status: 'no_key' });
        } else {
          upsertCard(container, hash, {
            status: 'error',
            message: msg,
            onRetry: () => void runTranslation(post, triggerBtn),
          });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      upsertCard(container, hash, {
        status: 'error',
        message: msg,
        onRetry: () => void runTranslation(post, triggerBtn),
      });
    } finally {
      setButtonLoading(triggerBtn, false);
      isLoading = false;
    }
  }
}

function sendMessage(request: TranslateRequest): Promise<TranslateResponse> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(request, (response: TranslateResponse | undefined) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (!response) {
        reject(new Error('No response from background worker'));
      } else {
        resolve(response);
      }
    });
  });
}
