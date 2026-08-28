// oxlint-disable eslint/max-lines
import type { Index } from './ingest';
import type { Card } from './schemas';

import { describe, expect, it } from 'vitest';

import { resolve } from './resolve';

/** Type the by-set record with the required index signature */
const sets = (value: Record<string, Record<string, Card>>) => value;

describe(resolve, () => {
  it('should return the oldest-first printings list for a bare name', () => {
    // Given
    const index: Index = {
      Doomsday: Object.assign(
        [
          {
            collector_number: '213',
            name: 'Doomsday',
            object: 'card',
            released_at: '1997-06-09',
            set: 'wth',
          },
          {
            collector_number: '1115',
            name: 'Doomsday',
            object: 'card',
            released_at: '2023-01-01',
            set: 'sld',
          },
          {
            collector_number: '1200',
            name: 'Doomsday',
            object: 'card',
            released_at: '2024-01-01',
            set: 'sld',
          },
          {
            collector_number: '319',
            name: 'Doomsday',
            object: 'card',
            released_at: '2026-11-13',
            set: 'trk',
          },
        ] satisfies Card[],
        sets({}),
      ),
    };
    // When
    const cards = resolve(index, { name: 'Doomsday' });
    // Then
    expect(cards.map((card) => card.collector_number)).toEqual([
      '213',
      '1115',
      '1200',
      '319',
    ]);
  });

  it('should resolve a specific printing', () => {
    // Given
    const index: Index = {
      Doomsday: Object.assign(
        [] satisfies Card[],
        sets({
          wth: {
            213: {
              collector_number: '213',
              name: 'Doomsday',
              object: 'card',
              released_at: '1997-06-09',
              set: 'wth',
            },
          },
        }),
      ),
    };
    // When
    const [card] = resolve(index, { name: 'Doomsday', set: 'wth' });
    // Then
    expect(card).toMatchObject({ collector_number: '213', set: 'wth' });
  });

  it('should resolve the oldest printing when a set has more than one', () => {
    // Given
    const index: Index = {
      Doomsday: Object.assign(
        [] satisfies Card[],
        sets({
          sld: {
            1115: {
              collector_number: '1115',
              name: 'Doomsday',
              object: 'card',
              released_at: '2023-01-01',
              set: 'sld',
            },
            1200: {
              collector_number: '1200',
              name: 'Doomsday',
              object: 'card',
              released_at: '2024-01-01',
              set: 'sld',
            },
          },
        }),
      ),
    };
    // When
    const [card] = resolve(index, { name: 'Doomsday', set: 'sld' });
    // Then
    expect(card).toMatchObject({ collector_number: '1115' });
  });

  it('should tie-break same-release-date printings by numeric collector number', () => {
    // Given
    const index: Index = {
      Preordain: Object.assign(
        [] satisfies Card[],
        sets({
          slz: {
            281: {
              collector_number: '281',
              name: 'Preordain',
              object: 'card',
              released_at: '2026-09-02',
              set: 'slz',
            },
            39: {
              collector_number: '39',
              name: 'Preordain',
              object: 'card',
              released_at: '2026-09-02',
              set: 'slz',
            },
            160: {
              collector_number: '160',
              name: 'Preordain',
              object: 'card',
              released_at: '2026-09-02',
              set: 'slz',
            },
          },
        }),
      ),
    };
    // When
    const [card] = resolve(index, { name: 'Preordain', set: 'slz' });
    // Then
    expect(card).toMatchObject({ collector_number: '39' });
  });

  it('should return nothing when the query casing does not match the name', () => {
    // Given
    const index: Index = {
      Doomsday: Object.assign(
        [] satisfies Card[],
        sets({
          wth: {
            213: {
              collector_number: '213',
              name: 'Doomsday',
              object: 'card',
              released_at: '1997-06-09',
              set: 'wth',
            },
          },
        }),
      ),
    };
    // When
    const cards = resolve(index, { name: 'doomsday', set: 'wth' });
    // Then
    expect(cards).toEqual([]);
  });

  it('should return nothing when the query set code casing does not match', () => {
    // Given
    const index: Index = {
      Doomsday: Object.assign(
        [] satisfies Card[],
        sets({
          wth: {
            213: {
              collector_number: '213',
              name: 'Doomsday',
              object: 'card',
              released_at: '1997-06-09',
              set: 'wth',
            },
          },
        }),
      ),
    };
    // When
    const cards = resolve(index, { name: 'Doomsday', set: 'WTH' });
    // Then
    expect(cards).toEqual([]);
  });

  it('should resolve a specific printing when name, set, and number are all known', () => {
    // Given
    const index: Index = {
      Doomsday: Object.assign(
        [] satisfies Card[],
        sets({
          sld: {
            1200: {
              collector_number: '1200',
              name: 'Doomsday',
              object: 'card',
              released_at: '2024-01-01',
              set: 'sld',
            },
          },
        }),
      ),
    };
    // When
    const [card] = resolve(index, {
      name: 'Doomsday',
      number: '1200',
      set: 'sld',
    });
    // Then
    expect(card).toMatchObject({ collector_number: '1200' });
  });

  it('should return nothing when name, set, and number are known but the number does not exist', () => {
    // Given
    const index: Index = {
      Doomsday: Object.assign(
        [] satisfies Card[],
        sets({
          sld: {
            1200: {
              collector_number: '1200',
              name: 'Doomsday',
              object: 'card',
              released_at: '2024-01-01',
              set: 'sld',
            },
          },
        }),
      ),
    };
    // When
    const cards = resolve(index, {
      name: 'Doomsday',
      number: '404',
      set: 'sld',
    });
    // Then
    expect(cards).toEqual([]);
  });

  it('should return nothing for an unknown name', () => {
    // Given
    const index: Index = {
      Counterspell: Object.assign(
        [
          {
            collector_number: '1',
            name: 'Counterspell',
            object: 'card',
            released_at: '1993-08-05',
            set: 'lea',
          },
        ] satisfies Card[],
        sets({}),
      ),
    };
    // When / Then
    expect(resolve(index, { name: 'Not a Real Card' })).toEqual([]);
  });

  it('should return nothing when the query is missing an accent', () => {
    // Given
    const index: Index = {
      "Lim-Dûl's Vault": Object.assign(
        [
          {
            collector_number: '73',
            name: "Lim-Dûl's Vault",
            object: 'card',
            released_at: '2013-11-01',
            set: 'c13',
          },
        ] satisfies Card[],
        sets({}),
      ),
    };
    // When
    const cards = resolve(index, { name: "Lim-Dul's Vault" });
    // Then
    expect(cards).toEqual([]);
  });

  it('should return nothing when the query uses a different quote style', () => {
    // Given
    const index: Index = {
      "Lim-Dûl's Vault": Object.assign(
        [
          {
            collector_number: '73',
            name: "Lim-Dûl's Vault",
            object: 'card',
            released_at: '2013-11-01',
            set: 'c13',
          },
        ] satisfies Card[],
        sets({}),
      ),
    };
    // When
    const cards = resolve(index, { name: 'Lim-Dûl’s Vault' });
    // Then
    expect(cards).toEqual([]);
  });

  it('should return nothing when the query has different spacing around "//"', () => {
    // Given
    const dis = {
      card_faces: [{ name: 'Wear' }, { name: 'Tear' }],
      collector_number: '145',
      name: 'Wear // Tear',
      object: 'card',
      released_at: '2006-10-06',
      set: 'dis',
    } satisfies Card;
    const index: Index = {
      'Wear // Tear': Object.assign([dis], sets({})),
      Wear: Object.assign([dis], sets({})),
    };
    // When
    const cards = resolve(index, { name: 'Wear//Tear' });
    // Then
    expect(cards).toEqual([]);
  });

  it('should return nothing for a known name with an unknown set', () => {
    // Given
    const index: Index = {
      Doomsday: Object.assign(
        [] satisfies Card[],
        sets({
          wth: {
            213: {
              collector_number: '213',
              name: 'Doomsday',
              object: 'card',
              released_at: '1997-06-09',
              set: 'wth',
            },
          },
        }),
      ),
    };
    // When
    const cards = resolve(index, { name: 'Doomsday', set: 'xyz' });
    // Then
    expect(cards).toEqual([]);
  });
});
