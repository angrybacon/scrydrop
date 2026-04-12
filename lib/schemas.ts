import * as z from 'zod';

// NOTE Someday Scryfall will provide production-ready typings for their API
//      currently documented here <https://scryfall.com/docs/api/cards>.
//      You can track progress here <https://github.com/scryfall/api-types>.

// Base schemas ////////////////////////////////////////////////////////////////

const ScryFaceSchema = z.object({
  artist: z.string().nullish(),
  flavor_text: z.string().nullish(),
  /** See <https://scryfall.com/docs/api/images> */
  image_uris: z
    .object({
      /** JPEG */
      art_crop: z.string(),
      /** JPEG 480×680 */
      border_crop: z.string(),
      /** JPEG 672×936 */
      large: z.string(),
      /** JPEG 488×680 */
      normal: z.string(),
      /** PNG 745×1040 */
      png: z.string(),
      /** JPEG 146×204 */
      small: z.string(),
    })
    .nullish(),
  name: z.string(),
  object: z.literal('card_face'),
  oracle_text: z
    .string()
    .transform((it) => it.split('\n'))
    .nullish(),
  printed_name: z.string().nullish(),
});

const ScryCardSchema = z.object({
  artist: ScryFaceSchema.shape.artist,
  card_faces: z.array(ScryFaceSchema).nullish(),
  color_identity: z
    .array(z.enum(['B', 'G', 'R', 'U', 'W']))
    .transform((colors) => colors.map((color) => color.toLowerCase()).sort()),
  content_warning: z.boolean().nullish(),
  flavor_text: ScryFaceSchema.shape.flavor_text,
  id: z.uuid(),
  image_uris: ScryFaceSchema.shape.image_uris,
  /** See <https://scryfall.com/docs/api/layouts> */
  layout: z.literal([
    'adventure',
    'art_series',
    'augment',
    'battle',
    'case',
    'class',
    'double_faced_token',
    'emblem',
    'flip',
    'host',
    'leveler',
    'meld',
    'modal_dfc',
    'mutate',
    'normal',
    'planar',
    'prototype',
    'reversible_card',
    'saga',
    'scheme',
    'split',
    'token',
    'transform',
    'vanguard',
  ]),
  name: ScryFaceSchema.shape.name,
  object: z.literal('card'),
  oracle_text: ScryFaceSchema.shape.oracle_text,
  printed_name: ScryFaceSchema.shape.printed_name,
  set: z.string(),
  set_name: z.string(),
});

const ScryListSchema = z.object({
  data: z.array(ScryCardSchema),
  has_more: z.boolean(),
  next_page: z.url().nullish(),
  object: z.literal('list'),
  total_cards: z.number().nullish(),
  warnings: z.array(z.string()).nullish(),
});

// Formatters //////////////////////////////////////////////////////////////////

const formatAlternate = (
  options: Pick<z.infer<typeof ScryCardSchema>, 'artist' | 'name' | 'set_name'>,
) => [
  `"${options.name}" from ${options.set_name}`,
  ...(options.artist ? [`Art by ${options.artist}`] : []),
];

const formatFaces = (card: z.infer<typeof ScryCardSchema>) => {
  const { card_faces, printed_name, ...rest } = {
    ...card,
    // NOTE Warm up a property to contain the LQIP data URLs when necessary
    lqip: undefined as { art: string; card: string } | undefined,
    name: card.printed_name || card.name,
  };
  if (!card_faces?.[0]) return [{ ...rest, alternate: formatAlternate(rest) }];
  return card_faces.map(({ name, object, printed_name, ...face }, index) => ({
    ...rest,
    ...face,
    alternate: formatAlternate({
      ...rest,
      ...face,
      name: printed_name || name,
    }),
    id: `${rest.id}-${index}`,
    name: printed_name || name,
  }));
};

// Exports /////////////////////////////////////////////////////////////////////

export const ScryCountResponseSchema = ScryListSchema.transform(
  ({ total_cards }) => total_cards ?? 0,
);

export const ScrySearchResponseSchema = ScryListSchema.transform(({ data }) =>
  data.map((faces) => formatFaces(faces)),
);

export const ScrySingleResponseSchema = z
  .discriminatedUnion('object', [ScryCardSchema, ScryListSchema])
  .transform((response) => {
    const card = response.object === 'list' ? response.data[0] : response;
    return card ? formatFaces(card) : [];
  });

export type ScryCountResponse = z.infer<typeof ScryCountResponseSchema>;
export type ScrySearchResponse = z.infer<typeof ScrySearchResponseSchema>;
export type ScrySingleResponse = z.infer<typeof ScrySingleResponseSchema>;
