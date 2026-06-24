const SEARCH_RE = /^!("?)([^"]+)\1$/u;
//                   ╰──╯╰─────╯
const SET_RE = /^\/cards\/([^/?]+)\/([^/?]+)(\?.*)?$/u;
//                        ╰──────╯  ╰──────╯

/**
 * Extract a `/cards/collection` identifier from the provided path.
 *
 * Only a subset of the endpoints implemented in `scry.ts` are actually
 * supported by the `/cards/collection` Scryfall endpoint and so the queries
 * that don't fit in _collection_ identifier will not be batched.
 *
 * See <https://scryfall.com/docs/api/cards/collection#card-identifiers>.
 */
export const batchable = (
  input: string,
  options: { greedy?: boolean } = {},
):
  | { collector_number: string; set: string }
  | { name: string; set?: string }
  | null => {
  if (input.startsWith('/cards/named')) {
    const [, query = ''] = input.split('?');
    const parameters = new URLSearchParams(query);
    const name = parameters.get('exact');
    const set = parameters.get('set');
    if (name && set) return { name, set };
    if (name) return { name };
    return null;
  } else if (options.greedy && input.startsWith('/cards/search')) {
    const [, query = ''] = input.split('?');
    const parameters = new URLSearchParams(query);
    const [, , name] = parameters.get('q')?.match(SEARCH_RE) ?? [];
    return name ? { name } : null;
  } else if (input.startsWith('/cards')) {
    const [, set, number] = input.match(SET_RE) ?? [];
    return set && number ? { collector_number: number, set } : null;
  }
  return null;
};
