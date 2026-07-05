import { z } from 'zod';

// Validate everything coming from the API — never trust the wire
export const userSchema = z
  .object({
    _id: z.string(),
    username: z.string(),
    email: z.string(),
    roles: z.array(z.string()),
    createdAt: z.string().optional(),
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

// Form schemas — mirror the backend's validation rules
export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters'),
  email: z.string().email('Enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password is too long'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
