import type { TranslationResult } from '../shared/types';
import { fnv1a } from '../shared/hash';

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
