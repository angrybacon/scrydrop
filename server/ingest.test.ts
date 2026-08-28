// oxlint-disable eslint/max-lines
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ingest } from './ingest';

describe(ingest, () => {
  let directory = '';
  let path = '';

  const write = (...cards: object[]) => {
    const jsonl = cards.map((card) => JSON.stringify(card)).join('\n');
    return writeFile(path, gzipSync(jsonl));
  };

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'scrydrop-ingest-'));
    path = join(directory, 'cards.jsonl.gz');
  });

  afterEach(() => rm(directory, { recursive: true, force: true }));

  it('should index printings by their exact name', async () => {
    // Given
    await write(
      {
        collector_number: '319',
        name: 'Doomsday',
        object: 'card',
        released_at: '2026-11-13',
        set: 'trk',
      },
      {
        collector_number: '213',
        name: 'Doomsday',
        object: 'card',
        released_at: '1997-06-09',
        set: 'wth',
      },
      {
        collector_number: '55',
        name: 'Brainstorm',
        object: 'card',
        released_at: '1996-06-10',
        set: 'ice',
      },
    );
    // When
    const index = await ingest(path);
    // Then
    expect(index.Brainstorm).toHaveLength(1);
    expect(index.Doomsday).toHaveLength(2);
  });

  it('should build the index in oldest-first order, regardless of JSONL order', async () => {
    // Given
    await write(
      {
        collector_number: '319',
        name: 'Doomsday',
        object: 'card',
        released_at: '2026-11-13',
        set: 'trk',
      },
      {
        collector_number: '213',
        name: 'Doomsday',
        object: 'card',
        released_at: '1997-06-09',
        set: 'wth',
      },
      {
        collector_number: '1200',
        name: 'Doomsday',
        object: 'card',
        released_at: '2024-01-01',
        set: 'sld',
      },
    );
    // When
    const index = await ingest(path);
    // Then
    expect(index.Doomsday?.map(({ set }) => set)).toEqual([
      'wth',
      'sld',
      'trk',
    ]);
  });

  it('should expose printings by set code and by collector number', async () => {
    // Given
    const one = {
      collector_number: '55',
      name: 'Brainstorm',
      object: 'card',
      released_at: '1996-06-10',
      set: 'ice',
    };
    const two = {
      collector_number: '1115',
      name: 'Doomsday',
      object: 'card',
      released_at: '2023-01-01',
      set: 'sld',
    };
    const three = {
      collector_number: '1200',
      name: 'Doomsday',
      object: 'card',
      released_at: '2024-01-01',
      set: 'sld',
    };
    const four = {
      collector_number: '319',
      name: 'Doomsday',
      object: 'card',
      released_at: '2026-11-13',
      set: 'trk',
    };
    const five = {
      collector_number: '213',
      name: 'Doomsday',
      object: 'card',
      released_at: '1997-06-09',
      set: 'wth',
    };
    await write(one, two, three, four, five);
    // When
    const index = await ingest(path);
    // Then
    expect(index).toEqual({
      Brainstorm: Object.assign([one], {
        ice: { [one.collector_number]: one },
      }),
      Doomsday: Object.assign([five, two, three, four], {
        sld: { [two.collector_number]: two, [three.collector_number]: three },
        trk: { [four.collector_number]: four },
        wth: { [five.collector_number]: five },
      }),
    });
  });

  it('should skip blank lines without failing', async () => {
    // Given
    const jsonl = [
      JSON.stringify({
        collector_number: '319',
        name: 'Doomsday',
        object: 'card',
        released_at: '2026-11-13',
        set: 'trk',
      }),
      '',
      '   ',
      JSON.stringify({
        collector_number: '213',
        name: 'Doomsday',
        object: 'card',
        released_at: '1997-06-09',
        set: 'wth',
      }),
    ].join('\n');
    await writeFile(path, gzipSync(jsonl));
    // When
    const index = await ingest(path);
    // Then
    expect(index.Doomsday).toHaveLength(2);
  });

  it('should reject a line that fails schema validation', async () => {
    // Given
    await write(
      {
        collector_number: '319',
        name: 'Doomsday',
        object: 'card',
        released_at: '2026-11-13',
        set: 'trk',
      },
      { name: 'Missing Required Fields', object: 'card' },
    );
    // When
    const test = () => ingest(path);
    // Then
    await expect(test).rejects.toThrow('collector_number');
  });

  it('should not let a name or set code collide with prototype properties', async () => {
    // Given
    const one = {
      collector_number: '21',
      name: 'valueOf',
      object: 'card',
      released_at: '1993-08-05',
      set: 'lea',
    };
    const two = {
      collector_number: '22',
      name: 'Shock',
      object: 'card',
      released_at: '1993-08-05',
      set: 'map',
    };
    await write(one, two);
    // When
    const index = await ingest(path);
    // Then
    expect(index).toEqual({
      valueOf: Object.assign([one], { lea: { [one.collector_number]: one } }),
      Shock: Object.assign([two], { map: { [two.collector_number]: two } }),
    });
  });

  it('should fail to index printings under a set code of "length"', async () => {
    // Given
    await write({
      collector_number: '1',
      name: 'Black Lotus',
      object: 'card',
      released_at: '1993-08-05',
      set: 'length',
    });
    // When
    const t = () => ingest(path);
    // Then
    await expect(t).rejects.toThrow('Cannot convert object to primitive value');
  });

  it('should index a card named "length"', async () => {
    // Given
    const one = {
      collector_number: '1',
      name: 'length',
      object: 'card',
      released_at: '1993-08-05',
      set: 'lea',
    };
    await write(one);
    // When
    const index = await ingest(path);
    // Then
    const card = Object.assign([one], { lea: { [one.collector_number]: one } });
    expect(index['length']).toEqual(card);
  });

  describe('Double-faced cards', () => {
    it('should index printings for double-faced cards', async () => {
      // Given
      await write(
        {
          collector_number: '319',
          name: 'Doomsday',
          object: 'card',
          released_at: '2026-11-13',
          set: 'trk',
        },
        {
          collector_number: '213',
          name: 'Doomsday',
          object: 'card',
          released_at: '1997-06-09',
          set: 'wth',
        },
        {
          card_faces: [{ name: 'Wear' }, { name: 'Tear' }],
          collector_number: '145',
          name: 'Wear // Tear',
          object: 'card',
          released_at: '2006-10-06',
          set: 'dis',
        },
      );
      // When
      const index = await ingest(path);
      // Then
      expect(index.Doomsday).toHaveLength(2);
      expect(index['Wear // Tear']).toHaveLength(1);
      expect(index.Wear).toHaveLength(1);
    });

    it('should not index a double-faced card by its second face', async () => {
      // Given
      await write({
        card_faces: [{ name: 'Wear' }, { name: 'Tear' }],
        collector_number: '145',
        name: 'Wear // Tear',
        object: 'card',
        released_at: '2006-10-06',
        set: 'dis',
      });
      // When
      const index = await ingest(path);
      // Then
      expect(index.Tear).toBeUndefined();
    });

    it('should not let the second face shadow an unrelated card of the same name', async () => {
      // Given
      await write(
        {
          card_faces: [{ name: 'Grave Researcher' }, { name: 'Reanimate' }],
          collector_number: '85',
          name: 'Grave Researcher // Reanimate',
          object: 'card',
          released_at: '2026-04-24',
          set: 'sos',
        },
        {
          collector_number: '68',
          name: 'Reanimate',
          object: 'card',
          released_at: '1997-10-14',
          set: 'tmp',
        },
      );
      // When
      const index = await ingest(path);
      // Then
      expect(index.Reanimate).toHaveLength(1);
      expect(index.Reanimate?.[0]).toMatchObject({ collector_number: '68' });
    });
  });
});
