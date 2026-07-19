import { z } from 'zod';

export const MEMBER_STATUSES = ['pending', 'accepted'] as const;
export const MAX_CIRCLE_DESCRIPTION_LENGTH = 300;

export const circleMemberSchema = z.object({
  user: z.string(),
  username: z.string(),
  status: z.enum(MEMBER_STATUSES),
  addedAt: z.string().optional(),
});

export const circleSchema = z
  .object({
    _id: z.string(),
    name: z.string(),
    description: z.string().default(''),
    owner: z.string(),
    ownerUsername: z.string(),
    members: z.array(circleMemberSchema).default([]),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .passthrough();

export const circlesResponseSchema = z.object({
  circles: z.array(circleSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
});
export const circleResponseSchema = z.object({ circle: circleSchema });

export type Circle = z.infer<typeof circleSchema>;
export type CircleMember = z.infer<typeof circleMemberSchema>;
export type PaginatedCircles = z.infer<typeof circlesResponseSchema>;

// Form schema — mirrors backend validation. Messages are translation keys
// (relative to the 'circles' namespace's `errors` object), not display text
// — see auth/schemas.ts for why.
export const circleFormSchema = z.object({
  name: z.string().trim().min(1, 'nameRequired').max(80, 'nameTooLong'),
  description: z.string().trim().max(MAX_CIRCLE_DESCRIPTION_LENGTH, 'descriptionTooLong'),
});

export type CircleFormInput = z.infer<typeof circleFormSchema>;

export const userSearchResultSchema = z.object({ _id: z.string(), username: z.string() });
export const userSearchResponseSchema = z.object({ users: z.array(userSearchResultSchema) });
export type UserSearchResult = z.infer<typeof userSearchResultSchema>;

// A pending invitation addressed to the current user — a slim summary (no
// member list) since they haven't accepted yet.
export const circleInviteSchema = z.object({
  _id: z.string(),
  name: z.string(),
  description: z.string().default(''),
  ownerUsername: z.string(),
});
export const circleInvitesResponseSchema = z.object({
  invites: z.array(circleInviteSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
});

export type CircleInvite = z.infer<typeof circleInviteSchema>;
export type PaginatedCircleInvites = z.infer<typeof circleInvitesResponseSchema>;
