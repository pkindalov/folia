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

// Form schema — mirrors backend validation. Messages are translation keys
// (relative to the 'flipbooks' namespace's `errors` object), not display
// text — see auth/schemas.ts for why.
export const albumFormSchema = z.object({
  title: z.string().trim().min(1, 'titleRequired').max(120, 'titleTooLong'),
  description: z.string().max(2000, 'descriptionTooLong'),
  visibility: z.enum(['private', 'shared', 'public']),
  sharedWithCircle: z.string().nullable().optional(),
});

export type AlbumFormInput = z.infer<typeof albumFormSchema>;

export const REACTION_TYPES = ['like', 'love', 'haha', 'wow', 'sad', 'angry'] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];

export const reactorSchema = z.object({
  // Absent for an album's reactors (albumReactionSummarySchema resolves those
  // as bare usernames, with no stable id available) — ReactorsModal falls
  // back to comparing by username in that case.
  user: z.string().optional(),
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
    commentCount: z.number().default(0),
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

export const commentSchema = z
  .object({
    _id: z.string(),
    page: z.string(),
    user: z.string(),
    username: z.string(),
    // Signed, time-limited avatar URL, resolved fresh on every response —
    // null for a commenter with no avatar set, same shape as
    // actorAvatarUrl on a notification.
    avatarUrl: z.string().nullable(),
    text: z.string(),
    // Set only on a reply — the top-level comment it answers. Replies are
    // exactly one level deep, so a reply's own parentComment is never set
    // on another comment that already has one.
    parentComment: z.string().nullable(),
    reactions: reactionSummarySchema,
    createdAt: z.string(),
    updatedAt: z.string().optional(),
  })
  .passthrough();
export type Comment = z.infer<typeof commentSchema>;

// A top-level comment as returned by listComments, with its first portion
// of replies embedded (see the backend's attachReplies) — hasMoreReplies
// drives the "Load more replies" button, which fetches further portions via
// listReplies rather than these ever being unbounded.
export const topLevelCommentSchema = commentSchema.extend({
  replies: z.array(commentSchema),
  hasMoreReplies: z.boolean(),
});
export type TopLevelComment = z.infer<typeof topLevelCommentSchema>;

export const commentsResponseSchema = z.object({
  comments: z.array(topLevelCommentSchema),
  // Whether an older portion exists beyond this response — drives the
  // "See earlier comments" button.
  hasMore: z.boolean(),
});
export const addCommentResponseSchema = z.object({
  comment: commentSchema,
  commentCount: z.number(),
});
export const deleteCommentResponseSchema = z.object({
  deleted: z.boolean(),
  commentCount: z.number(),
});
export const setCommentReactionResponseSchema = z.object({ reactions: reactionSummarySchema });
export const repliesResponseSchema = z.object({
  replies: z.array(commentSchema),
  // Whether a further portion exists beyond this response — drives the
  // "Load more replies" button, same shape as commentsResponseSchema's
  // hasMore.
  hasMore: z.boolean(),
});

export const MAX_COMMENT_LENGTH = 1000;

// Mirrors the backend's multer config (server/config/upload.js) — used for
// instant client-side feedback; the server remains the real boundary.
export const ALLOWED_PHOTO_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;
export const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024;
