import type { IncomingMessage, OutgoingHttpHeaders } from 'node:http';
import type { Index } from './ingest';

import { resolve } from './resolve';

const HEADERS = {
  JSON: { 'content-type': 'application/json; charset=utf-8' },
  TEXT: { 'content-type': 'text/plain; charset=utf-8' },
} as const satisfies Record<string, OutgoingHttpHeaders>;

/** The subset of `ServerResponse` this handler writes to */
type Responder = {
  end: () => void;
  write: (chunk: string) => void;
  writeHead: (status: number, headers: OutgoingHttpHeaders) => void;
};

/** Build a request handler serving printings from INDEX */
export const handle =
  (index: Index) =>
  (request: Pick<IncomingMessage, 'url'>, response: Responder): void => {
    const [, query = ''] = (request.url ?? '').split('?');
    const parameters = new URLSearchParams(query);
    const name = parameters.get('name');
    const number = parameters.get('number');
    const set = parameters.get('set');
    if (!name) {
      response.writeHead(400, HEADERS.TEXT);
      response.write(`Invalid identifier in "${request.url}"`);
      response.end();
      return;
    }
    const data = resolve(
      index,
      number && set ? { name, number, set } : set ? { name, set } : { name },
    );
    if (!data.length) {
      response.writeHead(404, HEADERS.TEXT);
      response.write(`Could not find indexed data for "${request.url}"`);
      response.end();
      return;
    }
    response.writeHead(200, HEADERS.JSON);
    response.write(JSON.stringify({ data, has_more: false, object: 'list' }));
    response.end();
  };
