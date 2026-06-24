import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Batcher } from './batcher';

describe(Batcher, () => {
  const fetcher = vi.fn<Parameters<typeof Batcher>[0]['fetcher']>();

  beforeEach(() => vi.useFakeTimers());

  afterEach(() => vi.useRealTimers());

  it('should resolve each enqueued item by index', async () => {
    // Given
    const cards = [{ name: 'Brainstorm' }, { name: 'Counterspell' }];
    fetcher.mockResolvedValueOnce({ data: cards, not_found: [] });
    const { enqueue } = Batcher({ debug: false, fetcher });
    // When
    const results = Promise.all([
      enqueue({ name: 'Brainstorm' }),
      enqueue({ name: 'Counterspell' }),
    ]);
    vi.advanceTimersByTime(1000);
    // Then
    await expect(results).resolves.toEqual(cards);
  });

  it('should reject all items when data length mismatches batch length', async () => {
    // Given
    fetcher.mockResolvedValueOnce({
      data: [{ name: 'Brainstorm' }],
      not_found: ['Ponder'],
    });
    const { enqueue } = Batcher({ debug: false, fetcher });
    // When
    const promises = [
      enqueue({ name: 'Brainstorm' }),
      enqueue({ name: 'Ponder' }),
    ];
    const assertion = () => {
      vi.advanceTimersByTime(1000);
      return Promise.all(promises);
    };
    // Then
    await expect(assertion).rejects.toThrow('Missing data');
  });

  it('should reject all items when the fetcher throws', async () => {
    // Given
    fetcher.mockRejectedValueOnce(new Error('Error'));
    const { enqueue } = Batcher({ debug: false, fetcher });
    // When
    const promise = enqueue({ name: 'Brainstorm' });
    const assertion = () => {
      vi.advanceTimersByTime(1000);
      return promise;
    };
    // Then
    await expect(assertion).rejects.toThrow('Error');
  });

  it('should reject with a wrapped error when the fetcher throws a string', async () => {
    // Given
    fetcher.mockRejectedValueOnce('Message');
    const { enqueue } = Batcher({ debug: false, fetcher });
    // When
    const promise = enqueue({ name: 'Brainstorm' });
    const assertion = () => {
      vi.advanceTimersByTime(1000);
      return promise;
    };
    // Then
    await expect(assertion).rejects.toEqual(new Error('Message'));
  });

  it('should not fetch again when the timer fires after a size-based flush', () => {
    // Given
    const data = Array.from({ length: 75 }, (_, i) => ({ name: `Card ${i}` }));
    fetcher.mockResolvedValueOnce({ data, not_found: [] });
    const { enqueue } = Batcher({ debug: false, fetcher });
    // When
    data.forEach((_, i) => void enqueue({ name: `Card ${i}` }));
    vi.advanceTimersByTime(2000);
    // Then
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('should flush immediately when the queue reaches flush size', async () => {
    // Given
    const data = Array.from({ length: 75 }, (_, i) => ({ name: `Card ${i}` }));
    fetcher.mockResolvedValueOnce({ data, not_found: [] });
    const { enqueue } = Batcher({ debug: false, fetcher });
    // When
    const promises = data.map((_, i) => enqueue({ name: `Card ${i}` }));
    const results = Promise.all(promises);
    vi.advanceTimersByTime(0);
    // Then
    await expect(results).resolves.toHaveLength(75);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('should batch items arriving before the flush interval', () => {
    // Given
    const cards = [{ name: 'Brainstorm' }, { name: 'Counterspell' }];
    fetcher.mockResolvedValueOnce({ data: cards, not_found: [] });
    const { enqueue } = Batcher({ debug: false, fetcher });
    // When
    void enqueue({ name: 'Brainstorm' });
    vi.advanceTimersByTime(500);
    void enqueue({ name: 'Counterspell' });
    vi.advanceTimersByTime(500);
    // Then
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledWith([
      { name: 'Brainstorm' },
      { name: 'Counterspell' },
    ]);
  });

  it('should log when debug is enabled', async () => {
    // Given
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const data = [{ name: 'Brainstorm' }];
    fetcher.mockResolvedValueOnce({ data, not_found: [] });
    const { enqueue } = Batcher({ debug: true, fetcher });
    // When
    void enqueue({ name: 'Brainstorm' });
    await vi.advanceTimersByTimeAsync(1000);
    // Then
    expect(spy).toHaveBeenNthCalledWith(1, expect.stringContaining('Queued'));
    expect(spy).toHaveBeenNthCalledWith(2, expect.stringContaining('Flushing'));
    expect(spy).toHaveBeenNthCalledWith(3, expect.stringContaining('Reading'));
  });

  it('should schedule a new flush when items arrive during a fetch', async () => {
    // Given
    fetcher
      .mockResolvedValueOnce({ data: [{ name: 'Brainstorm' }], not_found: [] })
      .mockResolvedValueOnce({ data: [{ name: 'Ponder' }], not_found: [] });
    const { enqueue } = Batcher({ debug: false, fetcher });
    // When
    const one = enqueue({ name: 'Brainstorm' });
    vi.advanceTimersByTime(1000);
    void enqueue({ name: 'Ponder' });
    vi.advanceTimersByTime(1000);
    // Then
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(await one).toStrictEqual({ name: 'Brainstorm' });
  });
});
