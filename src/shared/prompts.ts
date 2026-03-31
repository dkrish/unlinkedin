import type { Settings, HumorMode, TranslationStyle, OutputLength, PostMode } from './types';

const LENGTH_INSTRUCTIONS: Record<OutputLength, string> = {
  'one-liner': 'Return a single punchy sentence for the translation.',
  'short': 'Keep the translation to 2–4 sentences.',
  'full': 'Rewrite the full post in plain English, preserving all key points.',
};

const HUMOR_INSTRUCTIONS: Record<HumorMode, string> = {
  'dry': 'Deadpan and resigned, like a tired office worker who has seen it all. Observational, not mean.',
  'funny': 'Playful and self-aware, like a comedian doing a bit about LinkedIn culture. Make it land.',
  'savage-lite': 'Sharp and roasty — like a comedian calling out the absurdity to the poster\'s face. Funny first, pointed second. Never cruel or personal.',
};

const STYLE_INSTRUCTIONS: Record<TranslationStyle, string> = {
  'politely': 'Gently expose the subtext with a raised eyebrow — charitable but not blind.',
  'honestly': 'Cut through the fluff and say the quiet part loud. What are they ACTUALLY doing here?',
  'group-chat': "React to this like you're a comedian summarizing it for the group chat — riff on it, call out the absurdity, make your friends laugh.",
};

const ROAST_SYSTEM_PROMPT = `You are a sharp comedian doing commentary on LinkedIn posts — like a late-night writer reacting to corporate thought-leader content.

Your job is NOT to summarize. It's to riff, roast (lightly), and expose the gap between what they said and what they meant — with wit.

Rules:
- Punch at the behavior and the LinkedIn-ism, never at the person's identity or protected characteristics
- Do not invent facts — only riff on what's actually in the post
- The "translation" field should sound like a comedian's take, not a bullet-point summary
- Never open with "Ah," "Ah yes," "Well," or any filler throat-clearing — dive straight into the riff
- Vary your opening every time: mid-thought, a direct address, a mock quote, a blunt observation, whatever fits
- Return ONLY a valid JSON object — no markdown fences, no prose outside the JSON`;

const TLDR_SYSTEM_PROMPT = `You are a helpful assistant that summarizes LinkedIn posts into plain, concise English. No spin, no commentary — just what the post actually says.

Rules:
- Preserve all key facts and claims from the original
- Strip jargon and filler phrases — say it plainly
- Be neutral: no sarcasm, no editorializing
- Return ONLY a valid JSON object — no markdown fences, no prose outside the JSON`;

// Keep the named export for backward compatibility with existing imports
export const SYSTEM_PROMPT = ROAST_SYSTEM_PROMPT;

export function getSystemPrompt(settings: Settings): string {
  const prompts: Record<PostMode, string> = {
    roast: ROAST_SYSTEM_PROMPT,
    tldr: TLDR_SYSTEM_PROMPT,
  };
  return prompts[settings.postMode];
}

export function buildUserPrompt(text: string, settings: Settings): string {
  if (settings.postMode === 'tldr') {
    return `Summarize this LinkedIn post in plain English.

Length: ${LENGTH_INSTRUCTIONS[settings.outputLength]}

Post:
"""
${text}
"""

Return exactly this JSON object:
{
  "intent": "one sentence — the main point of this post",
  "translation": "your plain-English summary, stripped of jargon",
  "tone_score": <integer 1–10, where 1 = already plain, 10 = maximum corporate buzzword density>
}`;
  }

  const { humorMode, translationStyle, outputLength } = settings;
  return `Do a comedian's commentary on this LinkedIn post.

Comedian's voice: ${HUMOR_INSTRUCTIONS[humorMode]}
Angle: ${STYLE_INSTRUCTIONS[translationStyle]}
Length: ${LENGTH_INSTRUCTIONS[outputLength]}

Post:
"""
${text}
"""

Return exactly this JSON object:
{
  "intent": "one sentence — what are they really trying to say or signal?",
  "translation": "your comedian commentary — riff on it, don't just restate it",
  "tone_score": <integer 1–10, where 1 = already plain, 10 = maximum corporate buzzword density>
}`;
}
