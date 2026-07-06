// Default to same-origin requests: in dev, Vite proxies /api to the backend
// (see vite.config.ts), which also works from other devices on the LAN.
const BASE_URL = import.meta.env.VITE_API_URL ?? '';

const TOKEN_KEY = 'folia_token';

export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  // A FormData body needs the browser to set its own multipart boundary —
  // a hardcoded Content-Type here would break the upload.
  const isFormData = options.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string>),
  };

  const token = tokenStorage.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      body && typeof body.error === 'string' ? body.error : `Request failed (${res.status})`;
    throw new ApiError(res.status, message);
  }

  return body as T;
}
