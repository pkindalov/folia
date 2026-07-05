import { api, tokenStorage } from '../../lib/api-client';
import {
  authResponseSchema,
  meResponseSchema,
  type AuthResponse,
  type LoginInput,
  type RegisterInput,
  type User,
} from './schemas';

export async function login(input: LoginInput): Promise<AuthResponse> {
  const data = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  const parsed = authResponseSchema.parse(data);
  tokenStorage.set(parsed.token);
  return parsed;
}

export async function register(input: RegisterInput): Promise<AuthResponse> {
  const data = await api('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  const parsed = authResponseSchema.parse(data);
  tokenStorage.set(parsed.token);
  return parsed;
}

export async function fetchMe(): Promise<User> {
  const data = await api('/api/users/me');
  return meResponseSchema.parse(data).user;
}

export function logout(): void {
  tokenStorage.clear();
}
