export type PostMode = 'roast' | 'tldr';
export type HumorMode = 'dry' | 'funny' | 'savage-lite';
export type TranslationStyle = 'politely' | 'honestly' | 'group-chat';
export type OutputLength = 'one-liner' | 'short' | 'full';

export interface Settings {
  postMode: PostMode;
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
