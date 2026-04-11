#!/usr/bin/env node
import { createServer } from 'node:http';
import { RateLimit } from 'async-sema';
import { Option, program } from 'commander';

const API = 'https://api.scryfall.com';
const CACHE = new Map<string, Promise<string>>();

const { debug, host, port, rate } = program
  .addOption(new Option('--debug').default(false).env('DEBUG'))
  .addOption(new Option('--host <address>').default('127.0.0.1').env('HOST'))
  .addOption(new Option('--port <number>').default('3333').env('PORT'))
  .addOption(new Option('--rate <rps>').default('2').env('RATE'))
  .parse()
  .opts();

// NOTE See <https://scryfall.com/docs/api> for more details on the rate limit
const limit = RateLimit(Number.parseInt(rate), { uniformDistribution: true });

createServer(async (request, response) => {
  if (!request.url) return;
  if (!CACHE.has(request.url)) {
    await limit();
    const promise = fetch(`${API}${request.url}`).then(async (it) => {
      if (it.ok) return it.text();
      const error = await it.text();
      console.error(`Error while fetching "${request.url}"`, error);
      throw new Error(it.statusText);
    });
    CACHE.set(request.url, promise);
    if (debug) console.info(`Caching for "${request.url}"`);
  }
  try {
    const data = await CACHE.get(request.url);
    response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.write(data);
  } catch (error) {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    // TODO Retrieve error details from API response
    const message = error instanceof Error ? error.message : String(error);
    response.write(`Error "${message}" while fetching "${request.url}"`);
  } finally {
    response.end();
    if (debug) console.count(`GET ${request.url}`);
  }
}).listen(port, host, () => console.info(`Running on http://${host}:${port}`));
