import { describe, test, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route } from 'react-router-dom';
import LoginPage from './LoginPage';
import { tokenStorage } from '../../../lib/api-client';
import { renderWithProviders } from '../../../tests/test-utils';

const VALID_USER = {
  _id: '507f1f77bcf86cd799439011',
  username: 'pan',
  email: 'pan@test.com',
  roles: ['User'],
};

const jsonResponse = (body: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  }) as Response;

const renderLogin = () =>
  renderWithProviders(<LoginPage />, {
    route: '/login',
    path: '/login',
    extraRoutes: <Route path="/" element={<div>Home reached</div>} />,
  });

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

describe('LoginPage', () => {
  test('renders identifier, password and submit button', () => {
    renderLogin();
    expect(screen.getByLabelText('Email or username')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  test('shows validation errors and does not call the API on empty submit', async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText('Enter your email or username')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  test('surfaces the API error message on failed login', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ error: 'Invalid credentials' }, 401));
    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText('Email or username'), 'pan');
    await user.type(screen.getByLabelText('Password'), 'wrong-pass');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
    expect(tokenStorage.get()).toBeNull();
  });

  test('submits credentials, stores the token and navigates home', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ token: 'jwt-ok', user: VALID_USER }));
    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText('Email or username'), 'pan@test.com');
    await user.type(screen.getByLabelText('Password'), 'secret123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Home reached')).toBeInTheDocument();
    expect(tokenStorage.get()).toBe('jwt-ok');
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toMatch(/\/api\/auth\/login$/);
    expect(JSON.parse(options!.body as string)).toEqual({
      identifier: 'pan@test.com',
      password: 'secret123',
    });
  });

  test('disables the button while the request is pending', async () => {
    let resolveFetch: (r: Response) => void;
    vi.mocked(fetch).mockReturnValue(new Promise((r) => (resolveFetch = r)));
    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText('Email or username'), 'pan');
    await user.type(screen.getByLabelText('Password'), 'secret123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled()
    );
    resolveFetch!(jsonResponse({ token: 't', user: VALID_USER }));
  });

  test('links to the register page', () => {
    renderLogin();
    expect(screen.getByRole('link', { name: /create one/i })).toHaveAttribute(
      'href',
      '/register'
    );
  });
});
