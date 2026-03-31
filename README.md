# UnLinkedIn

A Chrome extension that does comedian commentary on LinkedIn thought-leader posts — calling out the gap between what they said and what they meant, with a light roast.

**"I'm humbled and honored to announce…"** → **"Just got promoted. Making it a whole thing."**

## How it works

A small "✦ What they really mean" button appears below each LinkedIn feed post. Click it and an LLM (via OpenRouter) riffs on the post: what they're really signaling, rewritten with some personality.

## Setup

### Prerequisites

- Node.js 24+ (use `.nvmrc`: `nvm use`)
- An [OpenRouter](https://openrouter.ai) account and API key

### Install and build

```bash
npm install
npm run icons    # generate placeholder PNG icons (first time only)
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
npm run dev     # rebuilds on file changes (run in separate terminal)
```

After each rebuild, click the reload icon on `chrome://extensions`.

## Settings

| Setting | Options | Default |
|---|---|---|
| Humor Mode | Dry / Funny / Savage-lite | Savage-lite |
| Translation Style | Politely / Honestly / Group chat | Group chat |
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
  content/       # Content script: injector, extractor, UI, cache
  background/    # Service worker: OpenRouter API calls
  popup/         # Popup settings page
  options/       # Full-page settings
scripts/
  generate-icons.cjs   # Creates placeholder PNG icons
dist/            # Built extension — load this in Chrome
```
