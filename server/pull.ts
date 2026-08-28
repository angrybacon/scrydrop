import { createWriteStream, existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import * as z from 'zod';

import { FILE } from './constants';
import { Progress } from './progress';
import { BulkSchema } from './schemas';

const PACKAGE = z
  .object({ version: z.string().default('development') })
  .parse(createRequire(import.meta.url)('../package.json'));

const HEADERS = {
  Accept: '*/*',
  'Content-Type': 'application/json',
  'User-Agent': `scrydrop/${PACKAGE.version}`,
};

/**
 * Download the latest Scryfall bulk export into DIRECTORY.
 *
 * Currently harcoded to the `default_cards` export but could be customizable in
 * the future. No-op when the file already exists, unless FORCE is set. Render a
 * progress bar when PROGRESS is true and stdout is a TTY.
 */
export const pull = async (
  directory: string,
  options: { force?: boolean; progress?: boolean } = {},
) => {
  const out = join(directory, FILE);
  if (!options.force && existsSync(out)) {
    console.info(`Bulk export already exists at "${out}"`);
    return;
  }
  const url = 'https://api.scryfall.com/bulk-data/default_cards';
  const meta = await fetch(url, { headers: HEADERS });
  if (!meta.ok) {
    throw new Error(`Failed to fetch metadata "${meta.statusText}"`);
  }
  const { jsonl_download_uri } = BulkSchema.parse(await meta.json());
  const data = await fetch(jsonl_download_uri, { headers: HEADERS });
  if (!data.ok || !data.body) {
    throw new Error(`Failed to download bulk export "${data.statusText}"`);
  }
  await mkdir(directory, { recursive: true });
  const total = Number(data.headers.get('content-length')) || 0;
  const source = Readable.fromWeb(data.body);
  const progress = options.progress ? Progress(total) : null;
  if (progress) source.on('data', (it: Buffer) => progress.update(it.length));
  try {
    await pipeline(source, createWriteStream(out));
  } catch (cause) {
    throw new Error(`Failed to write bulk export to "${out}"`, { cause });
  } finally {
    progress?.stop();
  }
  console.info(`Downloaded bulk export to "${out}"`);
};
