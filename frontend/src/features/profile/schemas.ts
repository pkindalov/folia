import { z } from 'zod';

// Form schema — mirrors the backend's PUT /api/users/me validation rules
export const updateProfileSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters'),
  email: z.string().email('Enter a valid email address'),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
