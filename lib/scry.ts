import type {
  ScryCountResponse,
  ScrySearchResponse,
  ScrySingleResponse,
} from './schemas';

import { getPlaiceholder } from 'plaiceholder';

import {
  ScryCountResponseSchema,
  ScrySearchResponseSchema,
  ScrySingleResponseSchema,
} from './schemas';

/**
 * Endpoints to query for a specific card.
 * See <https://scryfall.com/docs/api/cards>.
 */
const ENDPOINTS = {
  NAMED: '/cards/named',
  SEARCH: '/cards/search',
  SET: '/cards',
} as const;

const makePlaceholders = async (
  faces: ScrySingleResponse,
  headers: Record<string, string>,
) => {
  const [first] = faces;
  if (first?.image_uris) {
    const [art, card] = await Promise.all([
      // NOTE Not subject to the documented rate limits
      (await fetch(first.image_uris.art_crop, { headers })).arrayBuffer(),
      (await fetch(first.image_uris.small, { headers })).arrayBuffer(),
    ]);
    first.lqip = {
      art: (await getPlaiceholder(Buffer.from(art), { size: 32 })).base64,
      card: (await getPlaiceholder(Buffer.from(card), { size: 32 })).base64,
    };
  }
  return faces;
};

/**
 * Make a fetcher for Scryfall queries.
 *
 * Use HOST and the optional PORT to customize where the bulk export server
 * runs.
 *
 * The USER string is required and will be forwarded to all `fetch` calls as the
 * request `User-Agent` header.
 *
 * Some methods will support the LQIP option to generate _low quality image
 * placeholders_ for the results. This is useful for UIs where the client might
 * need a very lightweight and preliminary version of the imagery in order to
 * prevent CLS issues.
 *
 * Queries are not normalized.
 */
export const Scry = (configuration: {
  host: string;
  port?: string;
  /** The User-Agent identifier to use for all inner fetches */
  user: string;
}) => {
  const api = {
    bulk: [configuration.host, configuration.port].join(':'),
    remote: 'https://api.scryfall.com',
  };
  const headers = { 'User-Agent': configuration.user };

  return {
    /**
     * Count results for QUERY.
     *
     * Does not use the bulk export server! This makes a real Scryfall API call.
     *
     * Like search mode except less expensive for when all that matters is the
     * count of results that matched the QUERY.
     */
    count: async (query: string): Promise<ScryCountResponse> => {
      const url = new URL(ENDPOINTS.SEARCH, api.remote).toString();
      const parameters = new URLSearchParams({
        q: query.trim(),
        unique: 'cards',
      }).toString();
      const response = await fetch(`${url}?${parameters}`, { headers });
      if (!response.ok) throw new Error(await response.text());
      return ScryCountResponseSchema.parse(await response.json());
    },

    /**
     * Search for QUERY.
     *
     * Does not use the bulk export server! This makes a real Scryfall API call.
     *
     * The QUERY should ressemble that of the regular usage through Scryfall's
     * website. This will always yield a list of results. Pagination will be
     * handled soon :tm:.
     *
     * With optional LQIP, make the placeholder for each first face of the
     * search results.
     */
    search: async (
      query: string,
      options?: { lqip?: boolean },
    ): Promise<ScrySearchResponse> => {
      const url = new URL(ENDPOINTS.SEARCH, api.remote).toString();
      const parameters = new URLSearchParams({
        order: 'released',
        q: query.trim(),
        unique: 'cards',
      }).toString();
      const response = await fetch(`${url}?${parameters}`, { headers });
      if (!response.ok) throw new Error(await response.text());
      return ScrySearchResponseSchema.transform(async (cards) => {
        if (options?.lqip) {
          await Promise.all(
            cards.map((card) => makePlaceholders(card, headers)),
          );
        }
        return cards;
      }).parseAsync(await response.json());
    },

    /**
     * Query a single result with QUERY.
     *
     * The QUERY should consist of a unique card name and an optional set
     * separated by a `|`. Return the first result in case of multiple matches
     * and ignore pagination.
     *
     * Use MODE to either request the bulk export server index, or the Scryfall
     * API.
     *
     * With optional LQIP, make the placeholder for the first face of the search
     * result.
     */
    single: async (
      query: string,
      options: { lqip?: boolean; mode: 'bulk' | 'remote' },
    ): Promise<ScrySingleResponse> => {
      const [name = '', set = '', number = ''] = query
        .split('|')
        .map((it) => it.trim());
      let url: URL;
      const parameters = new URLSearchParams();
      if (options.mode === 'bulk') {
        url = new URL('', api.bulk);
        parameters.set('name', name);
        parameters.set('number', number);
        parameters.set('set', set);
      } else if (set && number) {
        url = new URL(`${ENDPOINTS.SET}/${set}/${number}`, api.remote);
      } else if (set && name) {
        url = new URL(ENDPOINTS.NAMED, api.remote);
        parameters.set('exact', name);
        parameters.set('set', set);
      } else {
        url = new URL(ENDPOINTS.SEARCH, api.remote);
        parameters.set('dir', 'asc');
        parameters.set('order', 'released');
        parameters.set('prefer', 'oldest');
        parameters.set('q', `!"${name}"`);
      }
      url.search = parameters.toString();
      const response = await fetch(url.toString(), { headers });
      if (!response.ok) throw new Error(await response.text());
      return ScrySingleResponseSchema.transform(async (faces) => {
        if (options.lqip) await makePlaceholders(faces, headers);
        return faces;
      }).parseAsync(await response.json());
    },
  };
};
