import type { Index } from './ingest';
import type { Card } from './schemas';

/**
 * Resolve a normalized IDENTIFIER against the bulk INDEX.
 *
 * Return a single card if possible or multiple matches otherwise, for instance
 * when the identifier is not precise enough. To keep parity with the remote
 * query, we return the array of results so that the Scryfall wrapper can
 * extract the first of the array.
 */
export const resolve = (
  index: Index,
  {
    name,
    number,
    set,
  }:
    | { name: string; number: string; set: string }
    | { name: string; number?: never; set: string }
    | { name: string; number?: never; set?: never },
): Card[] => {
  const printings = index[name];
  if (number) {
    const card = printings?.[set]?.[number];
    return card ? [card] : [];
  }
  if (set) {
    return Object.values(printings?.[set] ?? {}).toSorted(
      (a, b) =>
        a.released_at.localeCompare(b.released_at) ||
        a.collector_number.localeCompare(b.collector_number, 'en', {
          numeric: true,
        }),
    );
  }
  // NOTE Do not return the hybrid object array directly
  return [...(printings ?? [])];
};
