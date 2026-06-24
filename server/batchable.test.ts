import { describe, expect, it } from 'vitest';

import { batchable } from './batchable';

describe(batchable, () => {
  describe('Named endpoint', () => {
    it.each([
      ['/cards/named?exact=Dig Up&set=lea', { name: 'Dig Up', set: 'lea' }],
      ['/cards/named?exact=Dig%20Up&set=lea', { name: 'Dig Up', set: 'lea' }],
      ['/cards/named?exact=Counterspell', { name: 'Counterspell' }],
    ])('should batch %s', (input, expected) =>
      expect(batchable(input)).toEqual(expected),
    );

    it.each(['/cards/named?set=lea', '/cards/named?foo=bar', '/cards/named'])(
      'should return null for %s',
      (input) => expect(batchable(input)).toBeNull(),
    );
  });

  describe('Search endpoint', () => {
    const passing = [
      ['/cards/search?q=!"Dig Up"', { name: 'Dig Up' }],
      ['/cards/search?q=!"Dig%20Up"', { name: 'Dig Up' }],
      ['/cards/search?q=!Counterspell', { name: 'Counterspell' }],
    ] as const satisfies [
      input: string,
      expected: ReturnType<typeof batchable>,
    ][];

    it.each(passing)('should greedily batch %s', (input, expected) =>
      expect(batchable(input, { greedy: true })).toEqual(expected),
    );

    it.each(passing)(
      'should return null with greed disabled for %s',
      (input, _) => expect(batchable(input, { greedy: false })).toBeNull(),
    );

    it.each(passing)(
      'should return null without the greedy option for %s',
      (input, _) => expect(batchable(input)).toBeNull(),
    );

    it.each([
      '/cards/search?q=Daze',
      '/cards/search?q=daze',
      '/cards/search?q=!"Dig Up',
      '/cards/search?q=!"Dig%20Up',
      '/cards/search?q=!Dig Up"',
      '/cards/search?q=!Dig%20Up"',
      '/cards/search',
      '/cards/search?',
      '/cards/search?q=',
    ])('should return null for %s', (input) =>
      expect(batchable(input, { greedy: true })).toBeNull(),
    );
  });

  describe('Set endpoint', () => {
    it.each([
      ['/cards/lea/1', { collector_number: '1', set: 'lea' }],
      ['/cards/lea/1?foo=bar', { collector_number: '1', set: 'lea' }],
    ])('should batch %s', (input, expected) =>
      expect(batchable(input)).toEqual(expected),
    );

    it.each(['/cards', '/cards/lea', '/cards/lea/1/extra'])(
      'should return null for %s',
      (input) => expect(batchable(input)).toBeNull(),
    );
  });

  describe('Non-batchable URLs', () => {
    it.each(['/', '/unknown', '/cards/unknown'])(
      'should return null for %s',
      (input) => expect(batchable(input)).toBeNull(),
    );
  });
});
