import { createServer } from 'node:http';
import { join } from 'node:path';

import { FILE } from './constants';
import { handle } from './handle';
import { ingest } from './ingest';

/** Serve requests from a pre-downloaded bulk data export found in DIRECTORY */
export const start = async (
  directory: string,
  options: { host: string; port: string },
) => {
  const local = join(directory, FILE);
  const index = await ingest(local);
  console.info(`Loaded local bulk index from "${local}"`);
  const port = Math.trunc(Number(options.port));
  createServer(handle(index)).listen(port, options.host);
};
