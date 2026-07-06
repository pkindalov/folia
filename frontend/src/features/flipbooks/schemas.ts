import { z } from 'zod';

export const albumSchema = z
  .object({
    _id: z.string(),
    title: z.string(),
    description: z.string().default(''),
    visibility: z.enum(['private', 'shared', 'public']),
    owner: z.string(),
    pageCount: z.number().default(0),
    coverPage: z.string().nullable().optional(),
    coverImage: z.string().nullable().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .passthrough();

export const albumsResponseSchema = z.object({ albums: z.array(albumSchema) });
export const albumResponseSchema = z.object({ album: albumSchema });

export type Album = z.infer<typeof albumSchema>;

// A public album as shown on the Explore page — same shape, plus who made it.
export const publicAlbumSchema = albumSchema.extend({ ownerUsername: z.string() });
export const publicAlbumsResponseSchema = z.object({ albums: z.array(publicAlbumSchema) });

export type PublicAlbum = z.infer<typeof publicAlbumSchema>;

// Form schema — mirrors backend validation
export const albumFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Give this volume a title')
    .max(120, 'Title must be at most 120 characters'),
  description: z.string().max(2000, 'Description must be at most 2000 characters'),
  visibility: z.enum(['private', 'shared', 'public']),
});

export type AlbumFormInput = z.infer<typeof albumFormSchema>;

export const pageSchema = z
  .object({
    _id: z.string(),
    album: z.string(),
    filename: z.string(),
    mimeType: z.string(),
    size: z.number(),
    url: z.string(),
    caption: z.string().default(''),
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
