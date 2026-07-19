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
  const { username, email, password } = input;
  const data = await api('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, email, password }),
  });
  const parsed = authResponseSchema.parse(data);
  tokenStorage.set(parsed.token);
  return parsed;
}

export async function fetchMe(): Promise<User> {
  const data = await api('/api/users/me');
  return meResponseSchema.parse(data).user;
}

// Tells the server to invalidate every token already issued to this account
// (see the backend's tokenVersion bump), then forgets the token locally
// regardless of whether that call succeeds — a network failure here
// shouldn't leave the user stuck looking logged in on this device.
export async function logout(): Promise<void> {
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } catch {
    // Best effort — the token is forgotten locally either way, below.
  } finally {
    tokenStorage.clear();
  }
}
