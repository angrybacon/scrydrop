import * as z from 'zod';

/**
 * A schema for the _batch_ endpoint.
 *
 * We don't actually care about the actual shape of the cards because they will
 * be parsed in `Scry` anyway.
 *
 * See <https://scryfall.com/docs/api/cards/collection>
 */
export const ScryCollectionResponseSchema = z.object({
  data: z.looseObject({ object: z.literal('card') }).array(),
  not_found: z.unknown().array(),
  object: z.literal('list'),
});

/**
 * A schema for an error response.
 *
 * See <https://scryfall.com/docs/api/errors>
 */
export const ScryErrorResponseSchema = z.object({
  code: z.string(),
  details: z.string(),
  status: z.number(),
  type: z.string().nullish(),
  warnings: z.string().array().nullish(),
});
