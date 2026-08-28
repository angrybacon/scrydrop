import type { Card } from './schemas';

import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { createGunzip } from 'node:zlib';

import { CardSchema } from './schemas';

/** Printings grouped by number  */
type NumberPrintings = Record<string, Card>;

/** Printings grouped by set */
type SetPrintings = Record<string, NumberPrintings>;

/**
 * Hybrid array-record of printings.
 *
 * The array is sorted by release date ascending, then collector number. The
 * record is grouped by set codes.
 *
 * This is a real `Array` with extra string keys layered on. This type should
 * not be used outside of the `ingest` and `resolve` system since common copy
 * options will silently drop the extra properties.
 *
 * A set code could in theory collide with an `Array.prototype` method name and
 * shadow it, so never call methods on this value directly, only index, spread
 * or `for...of` it. The `.length` is safe too.
 */
type Printings = Card[] & SetPrintings;

/** Printings grouped by name */
export type Index = Record<string, Printings>;

/** Guard against names colliding with prototype keys */
const makeEmptyRecord = <T>(): Record<string, T> =>
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  Object.create(null) as Record<string, T>;

/**
 * Stream-parse a gzipped Scryfall bulk data into an index of printings.
 *
 * The input is a JSONL file and the output is the index searchable by name, set
 * and collector number.
 *
 * Keyed by exact name, nothing is normalized on purpose. A mistyped case,
 * accent, quote, or split-card spacing fails to resolve so that spelling
 * consistency is enforced.
 *
 * Double-faced cards are additionally indexed by their first face's name, so a
 * writer can reasonably guess what a bare name resolves to.
 */
export const ingest = async (path: string): Promise<Index> => {
  const staged = new Map<string, Map<string, Card[]>>();
  const file = createReadStream(path);
  const stream = file.pipe(createGunzip());
  const lines = createInterface({ crlfDelay: Infinity, input: stream });

  try {
    for await (const line of lines) {
      if (!line.trim()) continue;
      const card = CardSchema.parse(JSON.parse(line));
      const [face] = card.card_faces ?? [];
      const names = [card.name, ...(face ? [face.name] : [])];
      for (const name of names) {
        let sets = staged.get(name);
        if (!sets) staged.set(name, (sets = new Map<string, Card[]>()));
        let printings = sets.get(card.set);
        if (!printings) sets.set(card.set, (printings = []));
        printings.push(card);
      }
    }
  } finally {
    lines.close();
    stream.destroy();
    file.destroy();
  }

  const index = makeEmptyRecord<Printings>();

  for (const [name, bySet] of staged) {
    const final = makeEmptyRecord<NumberPrintings>();
    const printings: Card[] = [];
    for (const [set, cards] of bySet) {
      const byNumber = makeEmptyRecord<Card>();
      for (const card of cards) byNumber[card.collector_number] = card;
      final[set] = byNumber;
      printings.push(...cards);
    }
    printings.sort(
      (a, b) =>
        a.released_at.localeCompare(b.released_at) ||
        a.collector_number.localeCompare(b.collector_number, 'en', {
          numeric: true,
        }),
    );
    index[name] = Object.assign(printings, final);
  }

  return index;
};
