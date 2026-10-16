/**
 * Arabic text normalization for flexible, accent-insensitive and letter-variant search.
 */

export function normalizeArabic(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .trim()
    // Remove Arabic diacritics / tashkeel (fat-hah, dammah, kasrah, sukoon, shaddah, tanween)
    .replace(/[\u064B-\u065F\u0670]/g, '')
    // Normalize various forms of Alef (أ, إ, آ, ء, ٱ) to simple ا
    .replace(/[أإآءٱ]/g, 'ا')
    // Normalize Taa Marbuta (ة) to Haa (ه)
    .replace(/ة/g, 'ه')
    // Normalize Alif Maqsoora (ى) to Yaa (ي)
    .replace(/ى/g, 'ي')
    // Normalize Persian/Urdu variants if present
    .replace(/ك/g, 'ك')
    .replace(/ی/g, 'ي')
    .replace(/[\s\-_]+/g, ' ');
}

export function matchesArabicSearch(target: string, query: string): boolean {
  if (!query || !query.trim()) return true;
  if (!target) return false;

  const normalizedTarget = normalizeArabic(target);
  const normalizedQuery = normalizeArabic(query);

  const queryWords = normalizedQuery.split(' ').filter(Boolean);
  return queryWords.every((word) => normalizedTarget.includes(word));
}

/**
 * Utility to deduplicate an array of objects by unique `id` property to prevent duplicate React keys.
 */
export function deduplicateById<T extends { id: string }>(items: T[]): T[] {
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    if (item && item.id) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        result.push(item);
      }
    }
  }
  return result;
}

/**
 * Utility to check if a movement type is an incoming movement (وارد).
 */
export function isIncomingMovement(type: string | undefined | null): boolean {
  if (!type) return false;
  return (
    type === 'IN' ||
    type === 'MFG_IN' ||
    type === 'PRODUCTION_RECEIPT' ||
    type === 'PRODUCTION_RETURN' ||
    type === 'وارد من المصنع' ||
    type === 'وارد'
  );
}

/**
 * Utility to check if a movement type is an outgoing movement (صادر/تالف).
 */
export function isOutgoingMovement(type: string | undefined | null): boolean {
  if (!type) return false;
  return (
    type === 'OUT' ||
    type === 'MFG_OUT' ||
    type === 'PRODUCTION_DISPATCH' ||
    type === 'DAMAGED' ||
    type === 'خروج للمصنع' ||
    type === 'صادر'
  );
}


