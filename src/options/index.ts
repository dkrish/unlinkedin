import type { Settings, HumorMode, TranslationStyle, OutputLength } from '../shared/types';
import { DEFAULTS } from '../shared/constants';

const form = document.getElementById('settings-form') as HTMLFormElement;
const apiKeyInput = document.getElementById('api-key') as HTMLInputElement;
const humorSelect = document.getElementById('humor-mode') as HTMLSelectElement;
const styleSelect = document.getElementById('translation-style') as HTMLSelectElement;
const lengthSelect = document.getElementById('output-length') as HTMLSelectElement;
const saveBtn = document.getElementById('save-btn') as HTMLButtonElement;
const statusMsg = document.getElementById('status-msg') as HTMLElement;

async function loadState(): Promise<void> {
  const [local, sync] = await Promise.all([
    chrome.storage.local.get('apiKey') as Promise<{ apiKey?: string }>,
    chrome.storage.sync.get(['humorMode', 'translationStyle', 'outputLength']) as Promise<Partial<Settings>>,
  ]);

  apiKeyInput.value = local.apiKey ?? '';
  humorSelect.value = sync.humorMode ?? DEFAULTS.humorMode;
  styleSelect.value = sync.translationStyle ?? DEFAULTS.translationStyle;
  lengthSelect.value = sync.outputLength ?? DEFAULTS.outputLength;
}

async function saveState(): Promise<void> {
  saveBtn.disabled = true;
  statusMsg.textContent = '';

  await Promise.all([
    chrome.storage.local.set({ apiKey: apiKeyInput.value.trim() }),
    chrome.storage.sync.set({
      humorMode: humorSelect.value as HumorMode,
      translationStyle: styleSelect.value as TranslationStyle,
      outputLength: lengthSelect.value as OutputLength,
    } satisfies Settings),
  ]);

  statusMsg.textContent = 'Saved!';
  statusMsg.style.color = '#059669';
  saveBtn.disabled = false;

  setTimeout(() => { statusMsg.textContent = ''; }, 2000);
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  void saveState();
});

void loadState();
