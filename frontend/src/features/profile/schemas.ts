import { z } from 'zod';

// Form schema — mirrors the backend's PUT /api/users/me validation rules
export const updateProfileSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters'),
  email: z.string().email('Enter a valid email address'),
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
