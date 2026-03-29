import type { TranslationResult } from '../shared/types';
import { BRAND_COLOR, CARD_ID_PREFIX } from '../shared/constants';

export type UIState =
  | { status: 'loading' }
  | { status: 'result'; data: TranslationResult }
  | { status: 'error'; message: string; onRetry: () => void }
  | { status: 'too_short' }
  | { status: 'no_key' };

export function createTriggerButton(onClick: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.textContent = '✦ What they really mean';
  btn.setAttribute('type', 'button');
  btn.setAttribute('aria-label', 'Translate this LinkedIn post');
  Object.assign(btn.style, {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 12px',
    border: `1px solid ${BRAND_COLOR}`,
    borderRadius: '14px',
    background: 'transparent',
    color: BRAND_COLOR,
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: 'inherit',
    lineHeight: '1.5',
    transition: 'background 0.15s ease',
  });
  btn.addEventListener('mouseenter', () => {
    btn.style.background = 'rgba(124,58,237,0.07)';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.background = 'transparent';
  });
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  });
  return btn;
}

export function setButtonLoading(btn: HTMLButtonElement, loading: boolean): void {
  btn.disabled = loading;
  btn.textContent = loading ? '⟳ Translating…' : '✦ What they really mean';
  btn.style.opacity = loading ? '0.7' : '1';
}

/**
 * Creates the translation result card beneath the trigger button container,
 * or updates an existing one in-place. Idempotent — safe to call multiple times.
 */
export function upsertCard(
  anchorEl: Element,
  hash: string,
  state: UIState
): void {
  const id = `${CARD_ID_PREFIX}${hash}`;
  let card = document.getElementById(id);

  if (!card) {
    card = document.createElement('div');
    card.id = id;
    Object.assign(card.style, {
      margin: '6px 0 2px',
      borderRadius: '8px',
      border: '1px solid #e5e7eb',
      overflow: 'hidden',
      fontFamily: 'inherit',
      fontSize: '14px',
      lineHeight: '1.5',
    });
    anchorEl.after(card);
  }

  card.innerHTML = renderState(state, id);

  // Wire up retry button after innerHTML update
  if (state.status === 'error') {
    card.querySelector<HTMLButtonElement>('.ul-retry-btn')
      ?.addEventListener('click', state.onRetry);
  }
}

function renderState(state: UIState, cardId: string): string {
  switch (state.status) {
    case 'loading':
      return `
        <div style="padding:10px 14px;color:#6b7280;display:flex;align-items:center;gap:8px;font-size:13px;">
          <span style="display:inline-block;width:13px;height:13px;border:2px solid #e5e7eb;border-top-color:${BRAND_COLOR};border-radius:50%;animation:ul-spin 0.7s linear infinite;" aria-hidden="true"></span>
          Translating…
          <style>@keyframes ul-spin{to{transform:rotate(360deg)}}</style>
        </div>`;

    case 'result': {
      const { intent, translation, tone_score } = state.data;
      const score = Math.min(10, Math.max(1, Math.round(tone_score)));

      if (score <= 3) {
        return `
          <div style="padding:10px 14px;color:#6b7280;font-size:13px;font-style:italic;">
            This post is already pretty normal. Maybe LinkedIn is healing.
          </div>`;
      }

      const filledBars = Math.round(score / 2);
      const bars = Array.from({ length: 5 }, (_, i) =>
        `<span style="display:inline-block;width:10px;height:7px;border-radius:2px;background:${i < filledBars ? BRAND_COLOR : '#e5e7eb'};margin-right:2px;" aria-hidden="true"></span>`
      ).join('');

      return `
        <div style="background:#faf9ff;padding:12px 14px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span style="font-size:11px;font-weight:600;color:${BRAND_COLOR};text-transform:uppercase;letter-spacing:0.06em;">What they really mean</span>
            <button
              onclick="document.getElementById('${cardId}').style.display='none'"
              style="background:none;border:none;color:#9ca3af;cursor:pointer;font-size:18px;line-height:1;padding:0;font-family:inherit;"
              aria-label="Dismiss translation"
            >×</button>
          </div>
          <div style="color:#6b7280;font-size:12px;margin-bottom:8px;font-style:italic;">${escapeHtml(intent)}</div>
          <div style="color:#111827;">${escapeHtml(translation)}</div>
          <div style="display:flex;align-items:center;gap:6px;margin-top:10px;">
            <span style="font-size:11px;color:#9ca3af;">Corporate density</span>
            <div role="img" aria-label="${score} out of 10">${bars}</div>
            <span style="font-size:11px;color:#9ca3af;">${score}/10</span>
          </div>
        </div>`;
    }

    case 'error':
      return state.message === 'NO_API_KEY'
        ? `<div style="padding:10px 14px;font-size:13px;color:#6b7280;">
            No API key set.
            <a href="#" onclick="chrome.runtime.openOptionsPage();return false;" style="color:${BRAND_COLOR};text-decoration:none;font-weight:500;">Open settings →</a>
           </div>`
        : `<div style="padding:10px 14px;font-size:13px;color:#dc2626;">
            Translation failed.
            <button class="ul-retry-btn" style="background:none;border:none;color:${BRAND_COLOR};cursor:pointer;text-decoration:underline;font-size:13px;font-family:inherit;padding:0;">Retry</button>
           </div>`;

    case 'too_short':
      return `<div style="padding:10px 14px;font-size:13px;color:#9ca3af;font-style:italic;">Not enough corporate speak to work with.</div>`;

    case 'no_key':
      return `<div style="padding:10px 14px;font-size:13px;color:#6b7280;">
        Add an OpenRouter API key to get started.
        <a href="#" onclick="chrome.runtime.openOptionsPage();return false;" style="color:${BRAND_COLOR};text-decoration:none;font-weight:500;">Open settings →</a>
      </div>`;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
