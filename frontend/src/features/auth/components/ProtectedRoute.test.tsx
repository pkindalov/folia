import { describe, test, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { Route } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import { tokenStorage } from '../../../lib/api-client';
import { renderWithProviders } from '../../../tests/test-utils';

describe('ProtectedRoute', () => {
  test('redirects to /login when there is no token', () => {
    renderWithProviders(<ProtectedRoute />, {
      route: '/',
      path: '/',
      extraRoutes: (
        <>
          <Route path="/login" element={<div>Login screen</div>} />
        </>
      ),
    });
    expect(screen.getByText('Login screen')).toBeInTheDocument();
  });

  test('renders the nested route when a token exists', () => {
    tokenStorage.set('some-jwt');
    renderWithProviders(<ProtectedRoute />, {
      route: '/secret',
      path: '/',
      extraRoutes: (
        <>
          <Route element={<ProtectedRoute />}>
            <Route path="/secret" element={<div>Secret content</div>} />
          </Route>
          <Route path="/login" element={<div>Login screen</div>} />
        </>
      ),
    });
    expect(screen.getByText('Secret content')).toBeInTheDocument();
    expect(screen.queryByText('Login screen')).not.toBeInTheDocument();
  });
});
