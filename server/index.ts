#!/usr/bin/env node
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { RateLimit } from 'async-sema';
import { Option, program } from 'commander';
import * as z from 'zod';

import { batchable } from './batchable';
import { Batcher } from './batcher';
import {
  ScryCollectionResponseSchema,
  ScryErrorResponseSchema,
} from './schemas';

const PACKAGE = z
  .object({ version: z.string().default('development') })
  .parse(createRequire(import.meta.url)('../package.json'));

const API = 'https://api.scryfall.com';

const CACHE = new Map<string, Promise<string>>();

const HEADERS = {
  Accept: '*/*',
  'Content-Type': 'application/json',
  'User-Agent': `scrydrop/${PACKAGE.version}`,
};

const { debug, greedy, host, port, rate } = program
  .addOption(new Option('--debug').default(false).env('DEBUG'))
  .addOption(new Option('--greedy').default(false).env('GREEDY'))
  .addOption(new Option('--host <address>').default('127.0.0.1').env('HOST'))
  .addOption(new Option('--port <number>').default('3333').env('PORT'))
  .addOption(new Option('--rate <rps>').default('1').env('RATE'))
  .parse()
  .opts<{
    debug: boolean;
    greedy: boolean;
    host: string;
    port: string;
    rate: string;
  }>();

// NOTE See <https://scryfall.com/docs/api> for more details on the rate limit
const limit = RateLimit(Math.trunc(Number(rate)));

const { enqueue } = Batcher({
  debug,
  fetcher: async (identifiers) => {
    await limit();
    const url = '/cards/collection';
    const response = await fetch(`${API}${url}`, {
      body: JSON.stringify({ identifiers }),
      headers: HEADERS,
      method: 'POST',
    });
    if (response.ok) {
      console.count(`GET ${url}`);
      const json = await response.json();
      return ScryCollectionResponseSchema.parse(json);
    }
    const error = await response.text();
    const parsed: unknown = JSON.parse(error);
    const { data, success } = ScryErrorResponseSchema.safeParse(parsed);
    const [code, message] = success
      ? [data.code, data.details]
      : ['unknown', parsed];
    console.error(`Error while fetching "${url}"`, message);
    throw new Error(code);
  },
});

// oxlint-disable-next-line typescript/no-misused-promises typescript/strict-void-return
createServer(async (request, response) => {
  if (!request.url) return;
  if (!CACHE.has(request.url)) {
    const identifier = batchable(request.url, { greedy });
    const promise = identifier
      ? enqueue(identifier).then((card) => JSON.stringify(card))
      : limit()
          .then(() => fetch(`${API}${request.url}`, { headers: HEADERS }))
          .then(async (it) => {
            if (it.ok) return it.text();
            const error = await it.text();
            console.error(`Error while fetching "${request.url}"`, error);
            throw new Error(it.statusText);
          });
    promise.catch(() => request.url && CACHE.delete(request.url));
    CACHE.set(request.url, promise);
  }
  try {
    const data = await CACHE.get(request.url);
    response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.write(data);
    console.count(`GET ${request.url}`);
  } catch (error) {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    const message = error instanceof Error ? error.message : String(error);
    response.write(`"${message}" while fetching "${request.url}"`);
  } finally {
    response.end();
  }
}).listen(Math.trunc(Number(port)), host);
