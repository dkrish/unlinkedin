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
