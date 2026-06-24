import * as z from 'zod';

// NOTE Someday Scryfall will provide production-ready typings for their API
//      currently documented here <https://scryfall.com/docs/api/cards>.
//
//      You can track progress here <https://github.com/scryfall/api-types>.

const formatAlternate = (
  input: Pick<z.infer<typeof ScryCardSchema>, 'artist' | 'name' | 'set_name'>,
) => [
  `"${input.name}" from ${input.set_name}`,
  ...(input.artist ? [`Art by ${input.artist}`] : []),
];

const formatFaces = (input: z.infer<typeof ScryCardSchema>) => {
  const {
    card_faces,
    printed_name: _printed_name,
    ...card
  } = {
    ...input,
    // NOTE Warm up a property to contain the LQIP data URLs when necessary
    lqip: undefined as { art: string; card: string } | undefined,
    name: input.printed_name ?? input.name,
  };
  if (!card_faces?.[0]) return [{ ...card, alternate: formatAlternate(card) }];
  return card_faces.map(
    ({ name, object: _object, printed_name, ...face }, index) =>
      Object.assign({}, card, face, {
        alternate: formatAlternate({
          artist: face.artist ?? card.artist,
          name: printed_name ?? name,
          set_name: card.set_name,
        }),
        id: `${card.id}-${index}`,
        name: printed_name ?? name,
      }),
  );
};

export const ScryFaceSchema = z.object({
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

export const ScryCardSchema = z.object({
  artist: ScryFaceSchema.shape.artist,
  card_faces: ScryFaceSchema.array().nullish(),
  color_identity: z
    .literal(['B', 'G', 'R', 'U', 'W'])
    .array()
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    .transform((it) => it.map((c) => c.toLowerCase() as Lowercase<typeof c>))
    .transform((it) => it.sort()),
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
    'prepare',
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

export const ScryListSchema = z.object({
  data: ScryCardSchema.array(),
  has_more: z.boolean(),
  next_page: z.url().nullish(),
  object: z.literal('list'),
  total_cards: z.number().nullish(),
  warnings: z.string().array().nullish(),
});

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

export type ScryCard = z.infer<typeof ScryCardSchema>;
export type ScryFace = z.infer<typeof ScryFaceSchema>;
export type ScryList = z.infer<typeof ScryListSchema>;
export type ScryCountResponse = z.infer<typeof ScryCountResponseSchema>;
export type ScrySearchResponse = z.infer<typeof ScrySearchResponseSchema>;
export type ScrySingleResponse = z.infer<typeof ScrySingleResponseSchema>;
