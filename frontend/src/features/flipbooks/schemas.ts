import { z } from 'zod';

// Only present on the responses that resolve it (getOne and the owner's own
// gallery list) — every other album-listing endpoint (public, archived,
// shared-with-me) doesn't render the love button, so this defaults to "no
// reactions" instead, rather than that being real data. reactors (who has
// loved the album) is resolved only by getOne — the batched gallery-list
// summary omits it since no UI there renders it — so it also defaults.
export const albumReactionSummarySchema = z.object({
  total: z.number(),
  viewerReacted: z.boolean(),
  reactors: z.array(z.string()).default([]),
});
export type AlbumReactionSummary = z.infer<typeof albumReactionSummarySchema>;

export const albumSchema = z
  .object({
    _id: z.string(),
    title: z.string(),
    description: z.string().default(''),
    visibility: z.enum(['private', 'shared', 'public']),
    owner: z.string(),
    sharedWithCircle: z.string().nullable().optional(),
    pageCount: z.number().default(0),
    coverPage: z.string().nullable().optional(),
    coverImage: z.string().nullable().optional(),
    archived: z.boolean().default(false),
    reactions: albumReactionSummarySchema.default({ total: 0, viewerReacted: false, reactors: [] }),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .passthrough();

export const albumsResponseSchema = z.object({
  albums: z.array(albumSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
});
export const albumResponseSchema = z.object({ album: albumSchema });

export type Album = z.infer<typeof albumSchema>;
export type PaginatedAlbums = z.infer<typeof albumsResponseSchema>;

// A public album as shown on the Explore page — same shape, plus who made it.
export const publicAlbumSchema = albumSchema.extend({ ownerUsername: z.string() });
export const publicAlbumsResponseSchema = z.object({
  albums: z.array(publicAlbumSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
});

export type PublicAlbum = z.infer<typeof publicAlbumSchema>;
export type PaginatedPublicAlbums = z.infer<typeof publicAlbumsResponseSchema>;

// Form schema — mirrors backend validation
export const albumFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Give this volume a title')
    .max(120, 'Title must be at most 120 characters'),
  description: z.string().max(2000, 'Description must be at most 2000 characters'),
  visibility: z.enum(['private', 'shared', 'public']),
  sharedWithCircle: z.string().nullable().optional(),
});

export type AlbumFormInput = z.infer<typeof albumFormSchema>;

export const REACTION_TYPES = ['like', 'love', 'haha', 'wow', 'sad', 'angry'] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];

export const reactorSchema = z.object({
  username: z.string(),
  type: z.enum(REACTION_TYPES),
});
export type Reactor = z.infer<typeof reactorSchema>;

export const reactionSummarySchema = z.object({
  counts: z.record(z.enum(REACTION_TYPES), z.number()),
  total: z.number(),
  viewerReaction: z.enum(REACTION_TYPES).nullable(),
  // Defaulted rather than required so existing fixtures/mocks that predate
  // this field don't need updating just to keep parsing.
  reactors: z.array(reactorSchema).default([]),
});
export type ReactionSummary = z.infer<typeof reactionSummarySchema>;

export const pageSchema = z
  .object({
    _id: z.string(),
    album: z.string(),
    filename: z.string(),
    mimeType: z.string(),
    size: z.number(),
    url: z.string(),
    caption: z.string().default(''),
    reactions: reactionSummarySchema,
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .passthrough();

export const pagesResponseSchema = z.object({ pages: z.array(pageSchema) });
export const uploadPagesResponseSchema = z.object({
  pages: z.array(pageSchema),
  pageCount: z.number(),
});
export const deletePageResponseSchema = z.object({
  deleted: z.boolean(),
  pageCount: z.number(),
});
export const updatePageCaptionResponseSchema = z.object({ page: pageSchema });
export const setCoverResponseSchema = z.object({ album: albumSchema });
export const setPageReactionResponseSchema = z.object({ reactions: reactionSummarySchema });
export const setAlbumReactionResponseSchema = z.object({ reactions: albumReactionSummarySchema });

export const MAX_CAPTION_LENGTH = 500;

export type Page = z.infer<typeof pageSchema>;

// Mirrors the backend's multer config (server/config/upload.js) — used for
// instant client-side feedback; the server remains the real boundary.
export const ALLOWED_PHOTO_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;
export const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024;
