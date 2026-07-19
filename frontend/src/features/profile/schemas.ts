import { z } from 'zod';

// Form schema — mirrors the backend's PUT /api/users/me validation rules.
// Messages are translation keys (relative to the 'profile' namespace's
// `errors` object), not display text — see auth/schemas.ts for why.
export const MIN_USERNAME_LENGTH = 3;
export const MAX_USERNAME_LENGTH = 30;

export const updateProfileSchema = z.object({
  username: z
    .string()
    .trim()
    .min(MIN_USERNAME_LENGTH, 'usernameTooShort')
    .max(MAX_USERNAME_LENGTH, 'usernameTooLong'),
  email: z.string().email('emailInvalid'),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// GET /api/users/:username — a distinct schema from auth's userSchema, not a
// derived .omit(), so it stays obvious at a glance that email can never
// appear here. No .passthrough(): unlike userSchema, this schema's whole job
// is to guarantee exclusion, so unknown fields (including a stray email, if
// the backend ever regresses) are dropped by parsing rather than passed through.
export const publicUserSchema = z.object({
  _id: z.string(),
  username: z.string(),
  roles: z.array(z.string()),
  createdAt: z.string().optional(),
  avatarUrl: z.string().nullable().optional(),
});

export const publicProfileResponseSchema = z.object({ user: publicUserSchema });

export type PublicUser = z.infer<typeof publicUserSchema>;
