# UnLinkedIn Chrome Extension — Design Spec

**Date:** 2026-03-28
**Status:** Approved
**Stack:** Manifest V3, TypeScript, Vite, Vanilla TS (no frameworks), OpenRouter (`openai/gpt-4o-mini`)

---

## Overview

A Chrome extension that detects LinkedIn feed posts and offers a one-click translation from corporate thought-leader speak into plain, honest, lightly funny English. The output is powered by an LLM (via OpenRouter) and is displayed inline beneath each post without breaking LinkedIn's layout.

The tone target: sharp and honest, not cruel. "Come on man, just say it" energy.

---

## Architecture

```
unlinkedin/
├── src/
│   ├── content/
│   │   ├── index.ts          # Entry: MutationObserver + post detection sweep
│   │   ├── injector.ts       # Injects translate button into each post
│   │   ├── extractor.ts      # Extracts full post text (handles "see more")
│   │   ├── ui.ts             # Builds/updates the translation card DOM
│   │   └── cache.ts          # In-memory translation cache (hash → result)
│   ├── background/
│   │   └── index.ts          # Service worker: OpenRouter API calls
│   ├── popup/
│   │   ├── index.html
│   │   └── index.ts          # API key input + settings form
│   ├── options/
│   │   ├── index.html
│   │   └── index.ts          # Full-page settings (same logic as popup)
│   └── shared/
│       ├── types.ts           # Shared interfaces: TranslationResult, Settings, Messages
│       ├── constants.ts       # LinkedIn selectors, defaults, model name, limits
│       └── prompts.ts         # System prompt + user prompt template builder
├── icons/
│   └── icon{16,32,48,128}.png
├── manifest.json
├── vite.config.ts
├── tsconfig.json
└── README.md
```

### Data Flow

1. Content script initializes `MutationObserver` on `document.body`
2. On new nodes: `processNewPosts()` finds unprocessed post containers
3. `injector.ts` stamps `data-ul-injected="true"` on each post + injects the trigger button
4. User clicks button → `extractor.ts` pulls full post text
5. Content script hashes text → checks in-memory cache
6. On cache miss: sends `TRANSLATE` message to background service worker
7. Background worker reads API key from `chrome.storage.local`, calls OpenRouter, returns `TranslationResult`
8. `ui.ts` renders the result card inline beneath the post
9. Result is cached in memory by hash — no re-calls on same post

---

## Content Script

### Post Detection

- `MutationObserver` watches `document.body` (subtree, childList)
- Selector targets `div[data-id]` within the feed container — most stable LinkedIn post anchor
- All selectors live in `constants.ts` for easy future adjustment
- Initial sweep runs on `DOMContentLoaded`; subsequent sweeps on each mutation batch

### Text Extraction (`extractor.ts`)

- Primary selector: `.feed-shared-update-v2__description` span
- Fallback: post's `aria-label` attribute
- If a "see more" / "…more" button exists within the post, it is clicked programmatically before extraction to capture full text; if the click fails or the button is not found, extraction proceeds with the visible text
- Posts under 80 characters: flagged as `TOO_SHORT`, handled with a soft UI message
- Posts over 4000 characters: truncated to 4000 chars before sending to LLM

### Deduplication

- Each processed post gets `data-ul-injected="true"`
- `processNewPosts()` skips any post with this attribute
- Prevents double-injection on LinkedIn's virtual DOM re-renders

### Request Queue / Debounce

- Button clicks debounced 300ms
- Post-level `isLoading` boolean flag prevents duplicate in-flight requests per post

---

## Background Service Worker (`background/index.ts`)

Handles all OpenRouter communication. The content script never touches the API key.

### Message Contract

```ts
// content → background
type TranslateRequest = {
  type: "TRANSLATE";
  payload: { text: string; settings: Settings };
};

// background → content (success)
type TranslationSuccess = {
  type: "TRANSLATION_RESULT";
  payload: TranslationResult;
};

// background → content (failure)
type TranslationError = {
  type: "TRANSLATION_ERROR";
  payload: { message: string };
};
```

### API Key Storage

- Stored in `chrome.storage.local` — not `sync`, to avoid putting secrets in Google's cloud
- Retrieved by background worker at request time (not cached in memory)

### Concurrency

- `Map<postHash, Promise<TranslationResult>>` tracks in-flight requests
- Duplicate requests for the same hash await the existing promise — no double API calls
- Map entry cleaned up after promise settles

### Model

- Default: `openai/gpt-4o-mini` via OpenRouter
- Configurable via `constants.ts`
- Max output tokens: 400

---

## Prompt Strategy (`shared/prompts.ts`)

### System Prompt

```
You are a dry, witty translator that converts LinkedIn corporate-speak into what the person actually means.

Rules:
- Preserve the original topic exactly — never invent or imply facts not present in the post
- Be honest and a little funny, but never cruel, defamatory, or personally abusive
- Do not target protected classes or make up personal details
- Return ONLY valid JSON, no markdown fences, no prose outside the JSON object
```

### User Prompt Template

Constructed from: post text + `humorMode` + `outputLength` + `translationStyle`.

Example for `funny` + `short` + `honestly`:
```
Translate this LinkedIn post into plain honest English with a funny tone.
Keep it short (2–4 sentences). Be direct, not mean.

Post:
"""
{postText}
"""

Return this JSON:
{
  "intent": "one sentence: what are they really trying to say?",
  "translation": "your rewritten version",
  "tone_score": <integer 1–10, where 1 = already plain, 10 = maximum corporate buzzword density>
}
```

### Output Schema

```ts
interface TranslationResult {
  intent: string;
  translation: string;
  tone_score: number; // 1–10
}
```

### Fallback Handling

| Failure mode | Recovery |
|---|---|
| JSON parse fails | Strip markdown fences, retry parse once |
| Still fails | Return error state, show retry button |
| `tone_score` missing | Default to 5 |
| `tone_score` ≤ 3 | Show: "This post is already pretty normal. Maybe LinkedIn is healing." |
| Post too short | Show: "Not enough corporate speak to work with." |
| API key missing | Show settings prompt with link to popup |

---

## Settings & Storage

### Popup / Options Page

Fields:
- **API Key** — masked text input, saved to `chrome.storage.local`
- **Humor mode** — `Dry | Funny | Savage-lite`
- **Translation style** — `Politely | Honestly | Group chat`
- **Output length** — `One-liner | Short rewrite | Full translation`

### Storage Layout

```ts
// chrome.storage.local (device-only, secrets)
interface LocalStorage {
  apiKey: string;
}

// chrome.storage.sync (roams with Chrome profile)
interface SyncStorage {
  humorMode: "dry" | "funny" | "savage-lite";
  translationStyle: "politely" | "honestly" | "group-chat";
  outputLength: "one-liner" | "short" | "full";
}
```

Defaults (applied if nothing is set): `funny`, `honestly`, `short`.

### Translation Cache

- In-memory `Map<hash, TranslationResult>` in the content script
- Hash: FNV-1a (fast, no dependency) over the full post text string
- Not persisted to storage — clears on page refresh
- Prevents repeat API calls during a single browsing session

---

## Injected UI (`content/ui.ts`)

### Styling Approach

- All styles are inline or scoped with the `ul-` class prefix
- No external fonts, no CSS framework
- Does not conflict with LinkedIn's stylesheet
- Card uses relative positioning, respects LinkedIn's post column max-width

### UI States

| State | Display |
|---|---|
| **Default** | Small "✦ What they really mean" button, muted gray |
| **Loading** | Spinner + "Translating..." text, button disabled |
| **Result** | Expandable card: intent label + translation text + tone indicator badge + collapse button |
| **Error** | Inline error message + retry button |
| **Too short** | Soft italicized message, no card |
| **Already plain** | Soft humorous note in place of translation |

### Card Structure

```
┌─────────────────────────────────────────────┐
│ ✦ What they really mean          [collapse] │
├─────────────────────────────────────────────┤
│ Intent: They got a new job.                 │
│                                             │
│ "I quit."                                   │
│                                             │
│ Corporate density: ████░░░░░░  6/10         │
└─────────────────────────────────────────────┘
```

---

## Build Configuration

- **Vite** with `rollupOptions` defining 4 entry points: `content`, `background`, `popup`, `options`
- Content script and background worker output as IIFE / ES module respectively
- `manifest.json` references built output paths
- TypeScript strict mode enabled
- No CSS preprocessor — plain inline styles in TS

---

## Resilience Notes

- LinkedIn selectors are volatile. All selectors are isolated in `constants.ts` with comments pointing to the DOM paths they target. When LinkedIn ships a redesign, this is the only file that needs updating.
- The extension is designed to fail silently — if post detection breaks, users just don't see the button. Nothing crashes LinkedIn.
- The background worker's `chrome.runtime.onMessage` handler catches all errors and returns a `TRANSLATION_ERROR` message rather than throwing.

---

## Future Extension Points

- Swap LinkedIn selectors for Twitter/X selectors in `constants.ts` to port to a new feed
- Add per-post feedback (thumbs up/down) to improve prompt tuning over time
- Allow custom model selection in settings (already parameterized via `constants.ts`)
- Persist cache across sessions via `chrome.storage.session`
