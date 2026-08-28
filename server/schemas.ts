import * as z from 'zod';

/**
 * A schema for the bulk export metadata.
 *
 * See <https://scryfall.com/docs/api/bulk-data>.
 */
export const BulkSchema = z.object({ jsonl_download_uri: z.url() });

/**
 * A single printing from a Scryfall bulk data card object.
 *
 * Bulk data card objects share the same schema as the live API and the
 * client-side `Scry` parsing already covers all relevant fields. Only the
 * fields used for indexing and lookup are required here, everything else is
 * passed through as-is.
 *
 * See <https://scryfall.com/docs/api/cards>.
 */
export const CardSchema = z.looseObject({
  card_faces: z.looseObject({ name: z.string() }).array().optional(),
  collector_number: z.string(),
  name: z.string(),
  object: z.literal('card'),
  released_at: z.string(),
  set: z.string(),
});

export type Card = z.infer<typeof CardSchema>;
