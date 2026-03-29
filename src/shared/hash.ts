/**
 * FNV-1a 32-bit hash — fast, no dependency, good distribution for short strings.
 * Returns a lowercase hex string.
 */
export function fnv1a(str: string): string {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16);
}
