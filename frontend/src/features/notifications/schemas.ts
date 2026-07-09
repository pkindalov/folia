import { z } from 'zod';

export const NOTIFICATION_TYPES = ['circle_invite'] as const;

export const notificationSchema = z
  .object({
    _id: z.string(),
    recipient: z.string(),
    type: z.enum(NOTIFICATION_TYPES),
    circle: z.string(),
    circleName: z.string(),
    actorUsername: z.string(),
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
