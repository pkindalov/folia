import type { ReactElement, ReactNode } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

type Options = {
  route?: string;
  path?: string;
  extraRoutes?: ReactNode;
};

/** Renders a component inside QueryClientProvider + MemoryRouter. */
export function renderWithProviders(
  ui: ReactElement,
  { route = '/', path = '/', extraRoutes }: Options = {}
) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path={path} element={ui} />
          {extraRoutes}
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}
