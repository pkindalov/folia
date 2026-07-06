import { z } from 'zod';

export const albumSchema = z
  .object({
    _id: z.string(),
    title: z.string(),
    description: z.string().default(''),
    visibility: z.enum(['private', 'shared', 'public']),
    owner: z.string(),
    pageCount: z.number().default(0),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .passthrough();

export const albumsResponseSchema = z.object({ albums: z.array(albumSchema) });
export const albumResponseSchema = z.object({ album: albumSchema });

export type Album = z.infer<typeof albumSchema>;

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
