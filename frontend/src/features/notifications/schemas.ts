import { z } from 'zod';

export const NOTIFICATION_TYPES = [
  'circle_invite',
  'circle_invite_accepted',
  'circle_invite_declined',
  'circle_deleted',
  'album_shared',
  'album_updated',
  'album_deleted',
  'album_photos_added',
  'album_photo_removed',
  'album_photo_caption_updated',
  'page_reaction',
] as const;

export const REACTION_NOTIFICATION_TYPES = ['like', 'love', 'haha', 'wow', 'sad', 'angry'] as const;

export const notificationSchema = z
  .object({
    _id: z.string(),
    recipient: z.string(),
    type: z.enum(NOTIFICATION_TYPES),
    // Only present on circle-scoped types — page_reaction goes straight to
    // the album owner and may have neither.
    circle: z.string().optional(),
    circleName: z.string().optional(),
    actorUsername: z.string(),
    // Only present on the album_* and page_reaction types.
    album: z.string().optional(),
    albumTitle: z.string().optional(),
    // Only present on page_reaction.
    page: z.string().optional(),
    reactionType: z.enum(REACTION_NOTIFICATION_TYPES).optional(),
    read: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string().optional(),
  })
  .passthrough();

export const notificationsResponseSchema = z.object({
  notifications: z.array(notificationSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
});

export const notificationResponseSchema = z.object({ notification: notificationSchema });
export const unreadCountResponseSchema = z.object({ count: z.number() });

// Named AppNotification (not Notification) to avoid shadowing the DOM's
// built-in Notification API in any file that imports this bare.
export type AppNotification = z.infer<typeof notificationSchema>;
export type PaginatedNotifications = z.infer<typeof notificationsResponseSchema>;
