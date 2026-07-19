import { describe, test, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route } from 'react-router-dom';
import RegisterPage from './RegisterPage';
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

const renderRegister = () =>
  renderWithProviders(<RegisterPage />, {
    route: '/register',
    path: '/register',
    extraRoutes: <Route path="/" element={<div>Home reached</div>} />,
  });

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

describe('RegisterPage', () => {
  test('renders all fields', () => {
    renderRegister();
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm password')).toBeInTheDocument();
  });

  test('validates all fields client-side before hitting the API', async () => {
    const user = userEvent.setup();
    renderRegister();
    await user.type(screen.getByLabelText('Username'), 'ab');
    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.type(screen.getByLabelText('Password'), 'short');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText('Username must be at least 3 characters')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  test('shows the character limit in the validation error for an over-long username', async () => {
    const user = userEvent.setup();
    renderRegister();
    await user.type(screen.getByLabelText('Username'), 'x'.repeat(31));
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(
      await screen.findByText('Username must be at most 30 characters')
    ).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  test('surfaces server-side duplicate errors', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ error: 'username already exists' }, 400));
    const user = userEvent.setup();
    renderRegister();
    await user.type(screen.getByLabelText('Username'), 'pan');
    await user.type(screen.getByLabelText('Email'), 'pan@test.com');
    await user.type(screen.getByLabelText('Password'), 'secret123');
    await user.type(screen.getByLabelText('Confirm password'), 'secret123');
    await user.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText('username already exists')).toBeInTheDocument();
  });

  test('registers, stores the token and navigates home', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ token: 'jwt-new', user: VALID_USER }, 201));
    const user = userEvent.setup();
    renderRegister();
    await user.type(screen.getByLabelText('Username'), 'pan');
    await user.type(screen.getByLabelText('Email'), 'pan@test.com');
    await user.type(screen.getByLabelText('Password'), 'secret123');
    await user.type(screen.getByLabelText('Confirm password'), 'secret123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText('Home reached')).toBeInTheDocument();
    expect(tokenStorage.get()).toBe('jwt-new');
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toMatch(/\/api\/auth\/register$/);
    expect(JSON.parse(options!.body as string)).toEqual({
      username: 'pan',
      email: 'pan@test.com',
      password: 'secret123',
    });
  });

  test('links back to the login page', () => {
    renderRegister();
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login');
  });
});
