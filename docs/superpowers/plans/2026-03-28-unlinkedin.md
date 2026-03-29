# UnLinkedIn Chrome Extension — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-quality Chrome extension (MV3) that injects a "translate" button into LinkedIn feed posts and rewrites corporate thought-leader content into plain, honest, lightly funny English via OpenRouter.

**Architecture:** Three-config Vite build (pages, content IIFE, background ESM) with vanilla TypeScript throughout. Content script uses MutationObserver to detect posts and injects a UI card; a background service worker handles all OpenRouter API calls so the API key never touches the content script.

**Tech Stack:** TypeScript 5, Vite 5, Vitest + jsdom (testing), Chrome Extension Manifest V3, OpenRouter API (`openai/gpt-4o-mini`), zero runtime dependencies.

---

## File Map

| File | Responsibility |
|---|---|
| `src/shared/types.ts` | All shared TypeScript interfaces and union types |
| `src/shared/constants.ts` | LinkedIn selectors, model config, limits, defaults |
| `src/shared/prompts.ts` | System prompt + user prompt template builder |
| `src/content/cache.ts` | FNV-1a hash + in-memory translation cache |
| `src/content/extractor.ts` | DOM text extraction from LinkedIn posts |
| `src/content/ui.ts` | Creates/updates the injected translation card |
| `src/content/injector.ts` | Per-post button injection + click handling |
| `src/content/index.ts` | Entry: settings load, MutationObserver, sweep |
| `src/background/index.ts` | Service worker: OpenRouter API calls |
| `src/popup/index.html` | Popup markup |
| `src/popup/index.ts` | Popup logic: load/save settings |
| `src/options/index.html` | Full-page options markup (same as popup) |
| `src/options/index.ts` | Options logic (identical to popup) |
| `src/test/setup.ts` | Vitest global chrome API mocks |
| `manifest.json` | Extension manifest (MV3) |
| `vite.config.ts` | Vite build for popup + options HTML pages |
| `vite.config.content.ts` | Vite lib build for content script (IIFE) |
| `vite.config.bg.ts` | Vite lib build for background service worker (ESM) |
| `vitest.config.ts` | Vitest config with jsdom environment |
| `tsconfig.json` | TypeScript config |
| `scripts/generate-icons.cjs` | Generates placeholder PNG icons (pure Node.js) |

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `vite.config.ts`
- Create: `vite.config.content.ts`
- Create: `vite.config.bg.ts`
- Create: `src/test/setup.ts`

- [ ] **Step 1: Initialize package.json**

```bash
cd /path/to/unlinkedin
npm init -y
```

Then replace the generated `package.json` with:

```json
{
  "name": "unlinkedin",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "vite build && vite build --config vite.config.content.ts && vite build --config vite.config.bg.ts",
    "dev": "concurrently \"vite build --watch\" \"vite build --watch --config vite.config.content.ts\" \"vite build --watch --config vite.config.bg.ts\"",
    "test": "vitest run",
    "test:watch": "vitest",
    "icons": "node scripts/generate-icons.cjs"
  },
  "devDependencies": {
    "@types/chrome": "^0.0.268",
    "concurrently": "^8.2.2",
    "jsdom": "^24.0.0",
    "typescript": "^5.4.5",
    "vite": "^5.2.11",
    "vitest": "^1.5.3"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "lib": ["ES2020", "DOM"],
    "types": ["chrome"],
    "skipLibCheck": true
  },
  "include": ["src/**/*", "vite.config*.ts", "vitest.config.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: Create vite.config.ts** (popup + options pages)

```typescript
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: resolve(__dirname, 'src'),
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
        options: resolve(__dirname, 'src/options/index.html'),
      },
    },
  },
});
```

- [ ] **Step 5: Create vite.config.content.ts** (content script — IIFE, self-contained)

```typescript
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/content/index.ts'),
      name: 'UnLinkedIn',
      formats: ['iife'],
      fileName: () => 'content.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
```

- [ ] **Step 6: Create vite.config.bg.ts** (background service worker — ES module)

```typescript
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/background/index.ts'),
      formats: ['es'],
      fileName: () => 'background.js',
    },
  },
});
```

- [ ] **Step 7: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

- [ ] **Step 8: Create src/test/setup.ts**

```typescript
import { vi } from 'vitest';

// In-memory backing store shared across local + sync mocks
const mockStorage: Record<string, unknown> = {};

const storageMock = {
  get: vi.fn(async (keys: string | string[]) => {
    const ks = typeof keys === 'string' ? [keys] : keys;
    return Object.fromEntries(ks.map((k) => [k, mockStorage[k]]));
  }),
  set: vi.fn(async (items: Record<string, unknown>) => {
    Object.assign(mockStorage, items);
  }),
  onChanged: { addListener: vi.fn() },
};

vi.stubGlobal('chrome', {
  storage: {
    local: storageMock,
    sync: { ...storageMock, onChanged: { addListener: vi.fn() } },
  },
  runtime: {
    sendMessage: vi.fn(),
    lastError: null,
    openOptionsPage: vi.fn(),
  },
});
```

- [ ] **Step 9: Create directory structure**

```bash
mkdir -p src/content src/background src/popup src/options src/shared src/test scripts icons
```

- [ ] **Step 10: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors (no source files yet, so just config validation).

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts vite.config.ts vite.config.content.ts vite.config.bg.ts src/test/setup.ts
git commit -m "chore: scaffold project with Vite, TypeScript, Vitest"
```

---

## Task 2: Shared Types and Constants

**Files:**
- Create: `src/shared/types.ts`
- Create: `src/shared/constants.ts`

No unit tests — these are pure type/value definitions.

- [ ] **Step 1: Create src/shared/types.ts**

```typescript
export type HumorMode = 'dry' | 'funny' | 'savage-lite';
export type TranslationStyle = 'politely' | 'honestly' | 'group-chat';
export type OutputLength = 'one-liner' | 'short' | 'full';

export interface Settings {
  humorMode: HumorMode;
  translationStyle: TranslationStyle;
  outputLength: OutputLength;
}

export interface TranslationResult {
  intent: string;
  translation: string;
  tone_score: number;
}

// Message sent from content script to background
export interface TranslateRequest {
  type: 'TRANSLATE';
  payload: { text: string; settings: Settings };
}

// Messages sent from background to content script
export type TranslateResponse =
  | { type: 'TRANSLATION_RESULT'; payload: TranslationResult }
  | { type: 'TRANSLATION_ERROR'; payload: { message: string } };
```

- [ ] **Step 2: Create src/shared/constants.ts**

```typescript
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
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/shared/types.ts src/shared/constants.ts
git commit -m "feat: add shared types and constants"
```

---

## Task 3: Prompt Builder (TDD)

**Files:**
- Create: `src/shared/prompts.ts`
- Create: `src/shared/prompts.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/shared/prompts.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildUserPrompt, SYSTEM_PROMPT } from './prompts';
import type { Settings } from './types';

const baseSettings: Settings = {
  humorMode: 'funny',
  translationStyle: 'honestly',
  outputLength: 'short',
};

describe('SYSTEM_PROMPT', () => {
  it('instructs model to return only JSON', () => {
    expect(SYSTEM_PROMPT).toContain('JSON');
  });

  it('forbids cruelty', () => {
    expect(SYSTEM_PROMPT.toLowerCase()).toContain('cruel');
  });

  it('forbids invented facts', () => {
    expect(SYSTEM_PROMPT.toLowerCase()).toMatch(/invent|fabricat|made.up/);
  });
});

describe('buildUserPrompt', () => {
  it('includes the post text verbatim', () => {
    const text = 'Thrilled to announce I am beginning a new chapter.';
    expect(buildUserPrompt(text, baseSettings)).toContain(text);
  });

  it('includes all three JSON schema keys', () => {
    const prompt = buildUserPrompt('test post content here', baseSettings);
    expect(prompt).toContain('"intent"');
    expect(prompt).toContain('"translation"');
    expect(prompt).toContain('"tone_score"');
  });

  it('produces different output for different humor modes', () => {
    const dry = buildUserPrompt('test', { ...baseSettings, humorMode: 'dry' });
    const savage = buildUserPrompt('test', { ...baseSettings, humorMode: 'savage-lite' });
    expect(dry).not.toBe(savage);
  });

  it('produces different output for different output lengths', () => {
    const oneliner = buildUserPrompt('test', { ...baseSettings, outputLength: 'one-liner' });
    const full = buildUserPrompt('test', { ...baseSettings, outputLength: 'full' });
    expect(oneliner).not.toBe(full);
  });

  it('produces different output for different translation styles', () => {
    const polite = buildUserPrompt('test', { ...baseSettings, translationStyle: 'politely' });
    const groupchat = buildUserPrompt('test', { ...baseSettings, translationStyle: 'group-chat' });
    expect(polite).not.toBe(groupchat);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- src/shared/prompts.test.ts
```

Expected: `Cannot find module './prompts'`

- [ ] **Step 3: Implement src/shared/prompts.ts**

```typescript
import type { Settings, HumorMode, TranslationStyle, OutputLength } from './types';

const LENGTH_INSTRUCTIONS: Record<OutputLength, string> = {
  'one-liner': 'Return a single punchy sentence for the translation.',
  'short': 'Keep the translation to 2–4 sentences.',
  'full': 'Rewrite the full post in plain English, preserving all key points.',
};

const HUMOR_INSTRUCTIONS: Record<HumorMode, string> = {
  'dry': 'Use a dry, deadpan tone. Factual and slightly resigned.',
  'funny': 'Be genuinely funny and a bit self-aware. Light cynicism is welcome.',
  'savage-lite': 'Be sharp and direct. Cutting but not cruel — like a good friend who tells you the truth.',
};

const STYLE_INSTRUCTIONS: Record<TranslationStyle, string> = {
  'politely': 'Rephrase charitably but in plain language.',
  'honestly': 'Say what they actually mean without the corporate packaging.',
  'group-chat': "Rewrite it the way you'd summarize this post to a friend in a group chat.",
};

export const SYSTEM_PROMPT = `You are a dry, witty translator that converts LinkedIn corporate-speak into what the person actually means.

Rules:
- Preserve the original topic exactly — never invent or fabricate facts not present in the post
- Be honest and a little funny, but never cruel, defamatory, or personally abusive
- Do not target protected classes or make up personal details about the author
- Return ONLY a valid JSON object — no markdown fences, no prose outside the JSON`;

export function buildUserPrompt(text: string, settings: Settings): string {
  const { humorMode, translationStyle, outputLength } = settings;
  return `Translate this LinkedIn post into plain English.

Tone: ${HUMOR_INSTRUCTIONS[humorMode]}
Style: ${STYLE_INSTRUCTIONS[translationStyle]}
Length: ${LENGTH_INSTRUCTIONS[outputLength]}

Post:
"""
${text}
"""

Return exactly this JSON object:
{
  "intent": "one sentence — what are they really trying to say?",
  "translation": "your rewritten version",
  "tone_score": <integer 1–10, where 1 = already plain, 10 = maximum corporate buzzword density>
}`;
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test -- src/shared/prompts.test.ts
```

Expected: all 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/shared/prompts.ts src/shared/prompts.test.ts
git commit -m "feat: add prompt builder with tests"
```

---

## Task 4: Translation Cache (TDD)

**Files:**
- Create: `src/content/cache.ts`
- Create: `src/content/cache.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/content/cache.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { hashPost, getCached, setCached, hasCached, clearCache } from './cache';
import type { TranslationResult } from '../shared/types';

const sampleResult: TranslationResult = {
  intent: 'They got promoted.',
  translation: 'I got promoted.',
  tone_score: 7,
};

beforeEach(() => clearCache());

describe('hashPost', () => {
  it('returns the same hash for identical text', () => {
    expect(hashPost('hello world')).toBe(hashPost('hello world'));
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(hashPost('  Hello World  ')).toBe(hashPost('hello world'));
  });

  it('returns different hashes for different text', () => {
    expect(hashPost('hello')).not.toBe(hashPost('world'));
  });

  it('returns a non-empty hex string', () => {
    const hash = hashPost('test');
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });
});

describe('cache operations', () => {
  it('hasCached returns false for unknown hash', () => {
    expect(hasCached('unknown')).toBe(false);
  });

  it('getCached returns undefined for unknown hash', () => {
    expect(getCached('unknown')).toBeUndefined();
  });

  it('stores and retrieves a result', () => {
    setCached('abc', sampleResult);
    expect(getCached('abc')).toEqual(sampleResult);
    expect(hasCached('abc')).toBe(true);
  });

  it('clearCache removes all entries', () => {
    setCached('abc', sampleResult);
    clearCache();
    expect(hasCached('abc')).toBe(false);
  });

  it('stores different results under different hashes', () => {
    const other: TranslationResult = { intent: 'other', translation: 'other', tone_score: 3 };
    setCached('abc', sampleResult);
    setCached('def', other);
    expect(getCached('abc')).toEqual(sampleResult);
    expect(getCached('def')).toEqual(other);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- src/content/cache.test.ts
```

Expected: `Cannot find module './cache'`

- [ ] **Step 3: Implement src/content/cache.ts**

```typescript
import type { TranslationResult } from '../shared/types';

// FNV-1a 32-bit — fast, no dependency, good distribution for short strings
function fnv1a(str: string): string {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16);
}

const cache = new Map<string, TranslationResult>();

export function hashPost(text: string): string {
  return fnv1a(text.trim().toLowerCase());
}

export function getCached(hash: string): TranslationResult | undefined {
  return cache.get(hash);
}

export function setCached(hash: string, result: TranslationResult): void {
  cache.set(hash, result);
}

export function hasCached(hash: string): boolean {
  return cache.has(hash);
}

// Exported for test teardown only
export function clearCache(): void {
  cache.clear();
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test -- src/content/cache.test.ts
```

Expected: all 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/content/cache.ts src/content/cache.test.ts
git commit -m "feat: add translation cache with FNV-1a hash"
```

---

## Task 5: Post Text Extractor (TDD)

**Files:**
- Create: `src/content/extractor.ts`
- Create: `src/content/extractor.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/content/extractor.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- src/content/extractor.test.ts
```

Expected: `Cannot find module './extractor'`

- [ ] **Step 3: Implement src/content/extractor.ts**

```typescript
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
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test -- src/content/extractor.test.ts
```

Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/content/extractor.ts src/content/extractor.test.ts
git commit -m "feat: add post text extractor with see-more handling"
```

---

## Task 6: Background Service Worker (TDD for parse logic, then full implementation)

**Files:**
- Create: `src/background/index.ts`
- Create: `src/background/index.test.ts`

- [ ] **Step 1: Write the failing tests** (for the parse function only — network calls are not unit tested)

Create `src/background/index.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseTranslationResult } from './index';

describe('parseTranslationResult', () => {
  it('parses valid JSON with all fields', () => {
    const raw = JSON.stringify({
      intent: 'They got promoted.',
      translation: 'I got promoted.',
      tone_score: 8,
    });
    const result = parseTranslationResult(raw);
    expect(result.intent).toBe('They got promoted.');
    expect(result.translation).toBe('I got promoted.');
    expect(result.tone_score).toBe(8);
  });

  it('strips markdown code fences before parsing', () => {
    const raw = '```json\n{"intent":"a","translation":"b","tone_score":5}\n```';
    const result = parseTranslationResult(raw);
    expect(result.translation).toBe('b');
  });

  it('strips plain code fences without language tag', () => {
    const raw = '```\n{"intent":"a","translation":"b","tone_score":5}\n```';
    const result = parseTranslationResult(raw);
    expect(result.translation).toBe('b');
  });

  it('defaults tone_score to 5 when field is missing', () => {
    const raw = JSON.stringify({ intent: 'test intent', translation: 'plain English' });
    const result = parseTranslationResult(raw);
    expect(result.tone_score).toBe(5);
  });

  it('throws MALFORMED_RESPONSE for completely invalid JSON', () => {
    expect(() => parseTranslationResult('not json at all')).toThrow('MALFORMED_RESPONSE');
  });

  it('throws MALFORMED_RESPONSE if translation field is missing', () => {
    const raw = JSON.stringify({ intent: 'something', tone_score: 5 });
    expect(() => parseTranslationResult(raw)).toThrow('MALFORMED_RESPONSE');
  });

  it('throws MALFORMED_RESPONSE if intent field is missing', () => {
    const raw = JSON.stringify({ translation: 'something', tone_score: 5 });
    expect(() => parseTranslationResult(raw)).toThrow('MALFORMED_RESPONSE');
  });

  it('clamps tone_score to valid range', () => {
    const raw = JSON.stringify({ intent: 'a', translation: 'b', tone_score: 99 });
    const result = parseTranslationResult(raw);
    expect(result.tone_score).toBeLessThanOrEqual(10);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- src/background/index.test.ts
```

Expected: `Cannot find module './index'`

- [ ] **Step 3: Implement src/background/index.ts**

```typescript
import type { TranslateRequest, TranslateResponse, TranslationResult, Settings } from '../shared/types';
import { SYSTEM_PROMPT, buildUserPrompt } from '../shared/prompts';
import { MODEL, OPENROUTER_URL, MAX_OUTPUT_TOKENS } from '../shared/constants';

// Deduplicates concurrent requests for the same post hash
const inFlight = new Map<string, Promise<TranslationResult>>();

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

// FNV-1a 32-bit hash used as deduplication key for in-flight requests
function fnv1a(str: string): string {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16);
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test -- src/background/index.test.ts
```

Expected: all 8 tests pass.

- [ ] **Step 5: Run all tests**

```bash
npm test
```

Expected: all tests from Tasks 3, 4, 5, 6 pass (20+ total).

- [ ] **Step 6: Commit**

```bash
git add src/background/index.ts src/background/index.test.ts
git commit -m "feat: add background service worker with OpenRouter integration"
```

---

## Task 7: Translation Card UI

**Files:**
- Create: `src/content/ui.ts`

No automated tests — this module manipulates the DOM and is verified manually in Chrome.

- [ ] **Step 1: Create src/content/ui.ts**

```typescript
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
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/content/ui.ts
git commit -m "feat: add translation card UI component"
```

---

## Task 8: Post Injector

**Files:**
- Create: `src/content/injector.ts`

- [ ] **Step 1: Create src/content/injector.ts**

```typescript
import type { Settings, TranslateRequest, TranslateResponse } from '../shared/types';
import { SELECTORS, INJECTED_ATTR } from '../shared/constants';
import { extractPostText } from './extractor';
import { hashPost, getCached, setCached } from './cache';
import { createTriggerButton, setButtonLoading, upsertCard } from './ui';

let currentSettings: Settings;

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
    chrome.runtime.sendMessage(request, (response: TranslateResponse) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/content/injector.ts
git commit -m "feat: add per-post button injector with debounce and cache"
```

---

## Task 9: Content Script Entry Point

**Files:**
- Create: `src/content/index.ts`

- [ ] **Step 1: Create src/content/index.ts**

```typescript
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
```

- [ ] **Step 2: Run all tests to confirm nothing broke**

```bash
npm test
```

Expected: all tests still passing.

- [ ] **Step 3: Commit**

```bash
git add src/content/index.ts
git commit -m "feat: add content script entry with MutationObserver"
```

---

## Task 10: Popup and Options Pages

**Files:**
- Create: `src/popup/index.html`
- Create: `src/popup/index.ts`
- Create: `src/options/index.html`
- Create: `src/options/index.ts`

- [ ] **Step 1: Create shared settings form HTML — src/popup/index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>UnLinkedIn</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      color: #111827;
      background: #fff;
      width: 300px;
      padding: 18px 20px 20px;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 18px;
    }
    .header h1 {
      font-size: 15px;
      font-weight: 700;
      color: #7c3aed;
    }
    .field { margin-bottom: 13px; }
    label {
      display: block;
      font-size: 11px;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 5px;
    }
    input[type="password"],
    select {
      width: 100%;
      padding: 7px 10px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 13px;
      font-family: inherit;
      color: #111827;
      background: #fff;
      appearance: auto;
    }
    input:focus, select:focus {
      outline: none;
      border-color: #7c3aed;
      box-shadow: 0 0 0 2px rgba(124,58,237,0.12);
    }
    .hint {
      font-size: 11px;
      color: #9ca3af;
      margin-top: 4px;
    }
    .actions {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 16px;
    }
    .btn-save {
      padding: 7px 18px;
      background: #7c3aed;
      color: #fff;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.15s;
    }
    .btn-save:hover { background: #6d28d9; }
    .btn-save:disabled { opacity: 0.55; cursor: not-allowed; }
    #status-msg { font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <span aria-hidden="true">✦</span>
    <h1>UnLinkedIn</h1>
  </div>

  <form id="settings-form" novalidate>
    <div class="field">
      <label for="api-key">OpenRouter API Key</label>
      <input type="password" id="api-key" placeholder="sk-or-..." autocomplete="off" spellcheck="false">
      <p class="hint">Stored locally on this device only.</p>
    </div>

    <div class="field">
      <label for="humor-mode">Humor Mode</label>
      <select id="humor-mode">
        <option value="dry">Dry</option>
        <option value="funny" selected>Funny</option>
        <option value="savage-lite">Savage-lite</option>
      </select>
    </div>

    <div class="field">
      <label for="translation-style">Translation Style</label>
      <select id="translation-style">
        <option value="politely">Translate politely</option>
        <option value="honestly" selected>Translate honestly</option>
        <option value="group-chat">Translate like your group chat</option>
      </select>
    </div>

    <div class="field">
      <label for="output-length">Output Length</label>
      <select id="output-length">
        <option value="one-liner">One-liner</option>
        <option value="short" selected>Short rewrite</option>
        <option value="full">Full translation</option>
      </select>
    </div>

    <div class="actions">
      <button type="submit" class="btn-save" id="save-btn">Save</button>
      <span id="status-msg" aria-live="polite"></span>
    </div>
  </form>

  <script type="module" src="./index.ts"></script>
</body>
</html>
```

- [ ] **Step 2: Create src/popup/index.ts**

```typescript
import type { Settings } from '../shared/types';
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
      humorMode: humorSelect.value,
      translationStyle: styleSelect.value,
      outputLength: lengthSelect.value,
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
```

- [ ] **Step 3: Create src/options/index.html**

The options page is a wider version of the popup. Copy popup HTML and change the width:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>UnLinkedIn — Settings</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      color: #111827;
      background: #f9fafb;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      padding: 40px 20px;
    }
    .container {
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 28px 32px 32px;
      width: 100%;
      max-width: 480px;
      height: fit-content;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 24px;
    }
    .header h1 { font-size: 18px; font-weight: 700; color: #7c3aed; }
    .header p { font-size: 13px; color: #6b7280; margin-top: 2px; }
    .field { margin-bottom: 16px; }
    label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 6px;
    }
    input[type="password"],
    select {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #d1d5db;
      border-radius: 7px;
      font-size: 14px;
      font-family: inherit;
      color: #111827;
      background: #fff;
    }
    input:focus, select:focus {
      outline: none;
      border-color: #7c3aed;
      box-shadow: 0 0 0 2px rgba(124,58,237,0.12);
    }
    .hint { font-size: 12px; color: #9ca3af; margin-top: 5px; }
    .actions {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 22px;
    }
    .btn-save {
      padding: 9px 22px;
      background: #7c3aed;
      color: #fff;
      border: none;
      border-radius: 7px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.15s;
    }
    .btn-save:hover { background: #6d28d9; }
    .btn-save:disabled { opacity: 0.55; cursor: not-allowed; }
    #status-msg { font-size: 13px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <h1>✦ UnLinkedIn</h1>
        <p>Corporate-to-human translator</p>
      </div>
    </div>

    <form id="settings-form" novalidate>
      <div class="field">
        <label for="api-key">OpenRouter API Key</label>
        <input type="password" id="api-key" placeholder="sk-or-..." autocomplete="off" spellcheck="false">
        <p class="hint">Stored locally on this device only. Get one at openrouter.ai</p>
      </div>

      <div class="field">
        <label for="humor-mode">Humor Mode</label>
        <select id="humor-mode">
          <option value="dry">Dry — deadpan and factual</option>
          <option value="funny" selected>Funny — light cynicism, self-aware</option>
          <option value="savage-lite">Savage-lite — sharp but not cruel</option>
        </select>
      </div>

      <div class="field">
        <label for="translation-style">Translation Style</label>
        <select id="translation-style">
          <option value="politely">Translate politely</option>
          <option value="honestly" selected>Translate honestly</option>
          <option value="group-chat">Translate like your group chat</option>
        </select>
      </div>

      <div class="field">
        <label for="output-length">Output Length</label>
        <select id="output-length">
          <option value="one-liner">One-liner</option>
          <option value="short" selected>Short rewrite (2–4 sentences)</option>
          <option value="full">Full translation</option>
        </select>
      </div>

      <div class="actions">
        <button type="submit" class="btn-save" id="save-btn">Save settings</button>
        <span id="status-msg" aria-live="polite"></span>
      </div>
    </form>
  </div>

  <script type="module" src="./index.ts"></script>
</body>
</html>
```

- [ ] **Step 4: Create src/options/index.ts** (identical logic to popup)

```typescript
import type { Settings } from '../shared/types';
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
      humorMode: humorSelect.value,
      translationStyle: styleSelect.value,
      outputLength: lengthSelect.value,
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
```

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/popup/ src/options/
git commit -m "feat: add popup and options settings pages"
```

---

## Task 11: Manifest and Icons

**Files:**
- Create: `manifest.json`
- Create: `scripts/generate-icons.cjs`
- Create: `icons/icon16.png`, `icons/icon32.png`, `icons/icon48.png`, `icons/icon128.png`

- [ ] **Step 1: Create manifest.json**

```json
{
  "manifest_version": 3,
  "name": "UnLinkedIn",
  "version": "0.1.0",
  "description": "Translate LinkedIn thought-leader speak into what they actually mean.",
  "permissions": ["storage"],
  "host_permissions": [
    "https://www.linkedin.com/*",
    "https://openrouter.ai/*"
  ],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": [
        "https://www.linkedin.com/feed/",
        "https://www.linkedin.com/feed/*",
        "https://www.linkedin.com/"
      ],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "popup/index.html",
    "default_title": "UnLinkedIn",
    "default_icon": {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "options_page": "options/index.html",
  "icons": {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

- [ ] **Step 2: Create scripts/generate-icons.cjs** (pure Node.js, no dependencies)

```javascript
// Generates minimal valid PNG files for the extension icons.
// Run once with: node scripts/generate-icons.cjs
const fs = require('fs');
const zlib = require('zlib');

function uint32BE(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n, 0);
  return b;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBytes, data]);
  return Buffer.concat([uint32BE(data.length), typeBytes, data, uint32BE(crc32(crcInput))]);
}

function makePng(size, r, g, b) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = chunk(
    'IHDR',
    Buffer.concat([uint32BE(size), uint32BE(size), Buffer.from([8, 2, 0, 0, 0])])
  );
  const row = Buffer.alloc(1 + size * 3);
  row[0] = 0; // filter: None
  for (let x = 0; x < size; x++) {
    row[1 + x * 3] = r;
    row[2 + x * 3] = g;
    row[3 + x * 3] = b;
  }
  const rawPixels = Buffer.concat(Array.from({ length: size }, () => row));
  const idat = chunk('IDAT', zlib.deflateSync(rawPixels));
  const iend = chunk('IEND', Buffer.alloc(0));
  return Buffer.concat([sig, ihdr, idat, iend]);
}

fs.mkdirSync('icons', { recursive: true });

// Brand purple: #7c3aed = rgb(124, 58, 237)
const [r, g, b] = [124, 58, 237];

for (const size of [16, 32, 48, 128]) {
  const path = `icons/icon${size}.png`;
  fs.writeFileSync(path, makePng(size, r, g, b));
  console.log(`✓ ${path}`);
}
```

- [ ] **Step 3: Generate the icon files**

```bash
node scripts/generate-icons.cjs
```

Expected output:
```
✓ icons/icon16.png
✓ icons/icon32.png
✓ icons/icon48.png
✓ icons/icon128.png
```

- [ ] **Step 4: Commit**

```bash
git add manifest.json scripts/generate-icons.cjs icons/
git commit -m "feat: add manifest and placeholder icons"
```

---

## Task 12: Build Verification

- [ ] **Step 1: Run the full build**

```bash
npm run build
```

Expected: three sequential Vite builds complete without errors. Output in `dist/`:
```
dist/
  popup/
    index.html
  options/
    index.html
  content.js
  background.js
  icons/ (copy of icons — see Step 2)
```

- [ ] **Step 2: Copy static assets to dist**

The `icons/` directory and `manifest.json` need to land in `dist/`. Add a `postbuild` script to handle this.

Update `package.json` scripts section (add `postbuild`):

```json
"scripts": {
  "build": "vite build && vite build --config vite.config.content.ts && vite build --config vite.config.bg.ts",
  "postbuild": "cp manifest.json dist/ && cp -r icons dist/",
  "dev": "concurrently \"vite build --watch\" \"vite build --watch --config vite.config.content.ts\" \"vite build --watch --config vite.config.bg.ts\"",
  "postdev": "cp manifest.json dist/ && cp -r icons dist/",
  "test": "vitest run",
  "test:watch": "vitest",
  "icons": "node scripts/generate-icons.cjs"
},
```

- [ ] **Step 3: Re-run the build**

```bash
npm run build
```

Expected: `dist/manifest.json` and `dist/icons/` now exist alongside the JS/HTML output.

- [ ] **Step 4: Verify dist structure**

```bash
ls dist/
```

Expected output (order may vary):
```
assets/   background.js   content.js   icons/   manifest.json   options/   popup/
```

- [ ] **Step 5: Load the extension in Chrome**

1. Open `chrome://extensions`
2. Enable **Developer mode** (toggle top-right)
3. Click **Load unpacked**
4. Select the `dist/` folder
5. Confirm the extension appears with the purple icon and no errors

- [ ] **Step 6: Run all tests one final time**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add package.json
git commit -m "chore: add postbuild asset copy step"
```

---

## Task 13: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create README.md**

```markdown
# UnLinkedIn

A Chrome extension that translates LinkedIn thought-leader posts into plain, honest, lightly funny English.

**"I'm humbled and honored to announce…"** → **"I got promoted."**

## How it works

A small "✦ What they really mean" button appears below each LinkedIn feed post. Click it to get an LLM-powered plain-English translation via OpenRouter.

## Setup

### Prerequisites

- Node.js 18+
- An [OpenRouter](https://openrouter.ai) account and API key

### Install and build

```bash
npm install
npm run icons    # generate placeholder PNG icons
npm run build    # outputs to dist/
```

### Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** → select the `dist/` folder
4. Click the extension icon → paste your OpenRouter API key → Save

### Local development (watch mode)

```bash
npm run build   # initial build
npm run dev     # rebuilds on file changes
```

Reload the extension in `chrome://extensions` after each rebuild.

## Settings

| Setting | Options | Default |
|---|---|---|
| Humor Mode | Dry / Funny / Savage-lite | Funny |
| Translation Style | Politely / Honestly / Group chat | Honestly |
| Output Length | One-liner / Short rewrite / Full | Short rewrite |

Access via the extension popup or `chrome://extensions` → Details → Extension options.

## Model

Default: `openai/gpt-4o-mini` via OpenRouter (~$0.15/M input tokens).
To change: update `MODEL` in `src/shared/constants.ts` and rebuild.

## LinkedIn selector resilience

LinkedIn changes its DOM frequently. All selectors are isolated in `src/shared/constants.ts` → `SELECTORS`. If the button stops appearing on posts, check those selectors first.

## Running tests

```bash
npm test           # single run
npm run test:watch # watch mode
```

## Project structure

```
src/
  shared/        # Types, constants, prompt builder
  content/       # Content script (injector, extractor, UI, cache)
  background/    # Service worker (OpenRouter calls)
  popup/         # Popup settings page
  options/       # Full-page settings
scripts/
  generate-icons.cjs   # Creates placeholder PNG icons
dist/            # Built extension (load this in Chrome)
```
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with setup and dev instructions"
```

---

## Self-Review Checklist

### Spec coverage

| Spec requirement | Task |
|---|---|
| MutationObserver for infinite scroll | Task 9 |
| Post text extraction + see-more | Task 5 |
| Button injection with dedup | Task 8 |
| Background service worker | Task 6 |
| OpenRouter API call | Task 6 |
| API key in local storage | Task 10, Task 11 |
| Settings (humor/style/length) in sync storage | Task 10 |
| Translation cache per post hash | Task 4 |
| Loading / error / result UI states | Task 7 |
| Retry on error | Task 7, Task 8 |
| No-API-key state | Task 7, Task 8 |
| Already-plain detection (tone_score ≤ 3) | Task 7 |
| Too-short post handling | Task 5, Task 8 |
| Debounce on button click | Task 8 |
| JSON fallback / fence stripping | Task 6 |
| tone_score default when missing | Task 6 |
| Prompt varies by mode/style/length | Task 3 |
| Popup + options pages | Task 10 |
| Manifest V3 | Task 11 |
| Build verification | Task 12 |
| README | Task 13 |
| Icons | Task 11 |

All spec requirements are covered.

### Type consistency

- `TranslationResult`, `Settings`, `TranslateRequest`, `TranslateResponse` defined once in `src/shared/types.ts`, imported everywhere — no drift.
- `SELECTORS`, `BRAND_COLOR`, `CARD_ID_PREFIX`, `INJECTED_ATTR`, `DEFAULTS` defined once in `constants.ts`.
- `parseTranslationResult` exported from `background/index.ts` and imported in test — name matches.
- `upsertCard`, `createTriggerButton`, `setButtonLoading` exported from `ui.ts`, imported in `injector.ts` — names match.
- `injectPost`, `setSettings` exported from `injector.ts`, imported in `content/index.ts` — names match.
- `clearCache` exported from `cache.ts` for test teardown only — clearly named.

No inconsistencies found.
