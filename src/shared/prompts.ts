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
