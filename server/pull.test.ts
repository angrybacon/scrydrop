import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FILE } from './constants';
import { pull } from './pull';

const dataResponse = (stream: ReadableStream<Uint8Array>) =>
  new Response(stream, { headers: { 'content-length': '1000' }, status: 200 });

const metaResponse = () =>
  new Response(
    JSON.stringify({ jsonl_download_uri: 'protocol://domain.tld/resource' }),
    { status: 200 },
  );

/** A stream that emits one chunk then errors */
const failingStream = () =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array([1, 2, 3]));
      controller.error(new Error('Error'));
    },
  });

const successfulStream = () =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array([1, 2, 3]));
      controller.close();
    },
  });

describe(pull, () => {
  let directory = '';
  let isTTY: PropertyDescriptor | undefined;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'scrydrop-pull-'));
    isTTY = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(async () => {
    await rm(directory, { force: true, recursive: true });
    vi.unstubAllGlobals();
    if (isTTY) Object.defineProperty(process.stdout, 'isTTY', isTTY);
  });

  it('should skip the download when the file already exists', async () => {
    // Given
    await writeFile(join(directory, FILE), '');
    const fetchSpy = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchSpy);
    // When
    await pull(directory);
    // Then
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('should forward the package version as the user agent', async () => {
    // Given
    vi.doMock('node:module', () => ({
      createRequire: () => () => ({ version: 'custom' }),
    }));
    vi.resetModules();
    const { pull: pullWithMockedVersion } = await import('./pull');
    const fetchSpy = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(metaResponse())
      .mockResolvedValueOnce(dataResponse(successfulStream()));
    vi.stubGlobal('fetch', fetchSpy);
    // When
    await pullWithMockedVersion(directory);
    // Then
    const request = fetchSpy.mock.calls[0]?.[1];
    expect(request?.headers).toMatchObject({ 'User-Agent': 'scrydrop/custom' });
    vi.doUnmock('node:module');
    vi.resetModules();
  });

  it('should re-download when force is set, even if the file exists', async () => {
    // Given
    await writeFile(join(directory, FILE), '');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(metaResponse())
        .mockResolvedValueOnce(dataResponse(successfulStream())),
    );
    // When
    await pull(directory, { force: true });
    // Then
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('should show the cursor again when the download fails mid-stream', async () => {
    // Given
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(metaResponse())
        .mockResolvedValueOnce(dataResponse(failingStream())),
    );
    Object.defineProperty(process.stdout, 'isTTY', {
      configurable: true,
      value: true,
    });
    const write = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    // When
    const result = pull(directory, { progress: true });
    // Then
    await expect(result).rejects.toThrow(
      `Failed to write bulk export to "${join(directory, FILE)}"`,
    );
    const written = write.mock.calls.map(([chunk]) => String(chunk));
    expect(written.some((chunk) => chunk.includes('[?25l'))).toBe(true);
    expect(written.some((chunk) => chunk.includes('[?25h'))).toBe(true);
  });

  it('should wrap a failed download with a descriptive message', async () => {
    // Given
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(metaResponse())
        .mockResolvedValueOnce(dataResponse(failingStream())),
    );
    // When
    const result = pull(directory);
    // Then
    await expect(result).rejects.toThrow(
      `Failed to write bulk export to "${join(directory, FILE)}"`,
    );
    await expect(result).rejects.toHaveProperty('cause.message', 'Error');
  });

  it('should render progress when the progress option is enabled', async () => {
    // Given
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(metaResponse())
        .mockResolvedValueOnce(dataResponse(successfulStream())),
    );
    Object.defineProperty(process.stdout, 'isTTY', {
      configurable: true,
      value: true,
    });
    const write = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    // When
    await pull(directory, { progress: true });
    // Then
    expect(write).toHaveBeenCalled();
  });

  it('should never touch the cursor when progress is disabled', async () => {
    // Given
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(metaResponse())
        .mockResolvedValueOnce(dataResponse(successfulStream())),
    );
    Object.defineProperty(process.stdout, 'isTTY', {
      configurable: true,
      value: true,
    });
    const write = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    // When
    await pull(directory);
    // Then
    const written = write.mock.calls.map(([chunk]) => String(chunk));
    expect(written.some((chunk) => chunk.includes('[?25'))).toBe(false);
  });
});
