import { getPlaiceholder } from 'plaiceholder';

import {
  ScryCountResponseSchema,
  ScrySearchResponseSchema,
  ScrySingleResponseSchema,
  type ScryCountResponse,
  type ScrySearchResponse,
  type ScrySingleResponse,
} from './schemas';

/**
 * Endpoints to query for a specific card.
 * See <https://scryfall.com/docs/api/cards>.
 */
const API = {
  NAMED: '/cards/named',
  SEARCH: '/cards/search',
  SET: '/cards',
} as const;

const makePlaceholders = async (faces: ScrySingleResponse) => {
  const [first] = faces;
  if (first?.image_uris) {
    const [art, card] = await Promise.all([
      (await fetch(first.image_uris.art_crop)).arrayBuffer(),
      (await fetch(first.image_uris.small)).arrayBuffer(),
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
 * Use HOST and the optional PORT to target a specific API. This is useful when
 * hitting a cache server for instance.
 *
 * Some methods will support the LQIP option to generate _low quality image
 * placeholders_ for the results. This is useful for UIs where the client might
 * need a very lightweight and preliminary version of the imagery in order to
 * prevent CLS issues.
 */
export const Scry = (configuration: { host: string; port?: string }) => {
  const base = [configuration.host, configuration.port].join(':');
  return {
    /**
     * Count results for QUERY.
     *
     * Like search mode except less expensive for when all that matters is the
     * count of results that matched the QUERY.
     */
    count: async (query: string): Promise<ScryCountResponse> => {
      const url = new URL(API.SEARCH, base).toString();
      const parameters = new URLSearchParams({
        q: query.trim().toLowerCase(),
        unique: 'cards',
      }).toString();
      const response = await fetch(`${url}?${parameters}`);
      if (!response.ok) throw new Error(await response.text());
      return ScryCountResponseSchema.parse(await response.json());
    },

    /**
     * Search for QUERY.
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
      const url = new URL(API.SEARCH, base).toString();
      const parameters = new URLSearchParams({
        order: 'released',
        q: query.trim().toLowerCase(),
        unique: 'cards',
      }).toString();
      const response = await fetch(`${url}?${parameters}`);
      if (!response.ok) throw new Error(await response.text());
      return ScrySearchResponseSchema.transform(async (cards) => {
        if (options?.lqip) await Promise.all(cards.map(makePlaceholders));
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
     * With optional LQIP, make the placeholder for the first face of the search
     * result.
     */
    single: async (
      query: string,
      options?: { lqip?: boolean },
    ): Promise<ScrySingleResponse> => {
      const [name, set, number] = query
        .split('|')
        .map((it) => it.trim().toLowerCase());
      let parameters = '';
      let url = '';
      if (set && number) {
        parameters = '';
        url = new URL(`${API.SET}/${set}/${number}`, base).toString();
      } else if (set && name) {
        parameters = new URLSearchParams({ exact: name, set }).toString();
        url = new URL(API.NAMED, base).toString();
      } else {
        parameters = new URLSearchParams({
          dir: 'asc',
          order: 'released',
          q: `!"${name}"`,
          unique: 'prints',
        }).toString();
        url = new URL(API.SEARCH, base).toString();
      }
      const response = await fetch(`${url}?${parameters}`);
      if (!response.ok) throw new Error(await response.text());
      return ScrySingleResponseSchema.transform(async (faces) => {
        if (options?.lqip) await makePlaceholders(faces);
        return faces;
      }).parseAsync(await response.json());
    },
  };
};
