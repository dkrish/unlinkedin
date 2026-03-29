import type { TranslateRequest, TranslateResponse, TranslationResult, Settings } from '../shared/types';
import { SYSTEM_PROMPT, buildUserPrompt } from '../shared/prompts';
import { MODEL, OPENROUTER_URL, MAX_OUTPUT_TOKENS } from '../shared/constants';
import { fnv1a } from '../shared/hash';

// Deduplicates concurrent requests for the same post hash
const inFlight = new Map<string, Promise<TranslationResult>>();

if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener(
    (message: TranslateRequest, _sender, sendResponse) => {
      if (message.type !== 'TRANSLATE') return false;

      const { text, settings } = message.payload;
      const hash = fnv1a(text);

      handleTranslate(hash, text, settings)
        .then((payload) => {
          sendResponse({ type: 'TRANSLATION_RESULT', payload } satisfies TranslateResponse);
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          sendResponse({ type: 'TRANSLATION_ERROR', payload: { message: msg } } satisfies TranslateResponse);
        });

      // Return true to keep the message channel open for the async sendResponse call
      return true;
    }
  );
}

async function handleTranslate(
  hash: string,
  text: string,
  settings: Settings
): Promise<TranslationResult> {
  const existing = inFlight.get(hash);
  if (existing) return existing;

  const promise = callOpenRouter(text, settings).finally(() => {
    inFlight.delete(hash);
  });

  inFlight.set(hash, promise);
  return promise;
}

async function callOpenRouter(text: string, settings: Settings): Promise<TranslationResult> {
  const stored = await chrome.storage.local.get('apiKey') as { apiKey?: string };
  const apiKey = stored.apiKey?.trim();

  if (!apiKey) throw new Error('NO_API_KEY');

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/unlinkedin',
      'X-Title': 'UnLinkedIn',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(text, settings) },
      ],
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`API_ERROR_${response.status}: ${body.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = data?.choices?.[0]?.message?.content ?? '';

  return parseTranslationResult(raw);
}

// Exported for unit testing
export function parseTranslationResult(raw: string): TranslationResult {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('MALFORMED_RESPONSE');
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>).translation !== 'string' ||
    typeof (parsed as Record<string, unknown>).intent !== 'string'
  ) {
    throw new Error('MALFORMED_RESPONSE');
  }

  const p = parsed as Record<string, unknown>;
  const rawScore = typeof p.tone_score === 'number' ? p.tone_score : 5;

  return {
    intent: p.intent as string,
    translation: p.translation as string,
    tone_score: Math.min(10, Math.max(1, Math.round(rawScore))),
  };
}

