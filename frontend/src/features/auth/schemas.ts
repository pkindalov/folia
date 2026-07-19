import { z } from 'zod';

// Validate everything coming from the API — never trust the wire
export const userSchema = z
  .object({
    _id: z.string(),
    username: z.string(),
    email: z.string(),
    roles: z.array(z.string()),
    createdAt: z.string().optional(),
    avatarUrl: z.string().nullable().optional(),
  })
  .passthrough();

export const authResponseSchema = z.object({
  token: z.string(),
  user: userSchema,
});

export const meResponseSchema = z.object({
  user: userSchema,
});

export type User = z.infer<typeof userSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;

// Form schemas — mirror the backend's validation rules.
// Messages are translation keys (relative to the 'auth' namespace's `errors`
// object), not display text — schemas are built at module load, before any
// i18next context exists. Translate with t(`errors.${key}`) at the display site.
export const loginSchema = z.object({
  identifier: z.string().min(1, 'identifierRequired'),
  password: z.string().min(1, 'passwordRequired'),
});

export const registerSchema = z
  .object({
    username: z.string().trim().min(3, 'usernameTooShort').max(30, 'usernameTooLong'),
    email: z.string().email('emailInvalid'),
    password: z.string().min(8, 'passwordTooShort').max(128, 'passwordTooLong'),
    confirmPassword: z.string().min(1, 'confirmPasswordRequired'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'passwordsDoNotMatch',
    path: ['confirmPassword'],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
