import { describe, test, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateCircleModal from './CreateCircleModal';
import { tokenStorage } from '../../../lib/api-client';
import { renderWithProviders } from '../../../tests/test-utils';

const calledUrls: string[] = [];
const calledBodies: unknown[] = [];

function mockApi(routes: Record<string, { body: unknown; status?: number }>) {
  vi.mocked(fetch).mockImplementation((url, options) => {
    const path = String(url);
    calledUrls.push(path);
    if (options?.body) calledBodies.push(JSON.parse(options.body as string));
    const match = Object.entries(routes).find(([suffix]) => path.includes(suffix));
    const { body, status = 200 } = match?.[1] ?? { body: { error: 'Not found' }, status: 404 };
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    } as Response);
  });
}

const CREATED_CIRCLE = {
  _id: 'c1',
  name: 'The Sterling Family',
  description: 'Reunion crew',
  owner: 'id1',
  ownerUsername: 'pan',
  members: [],
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  tokenStorage.set('jwt-ok');
  calledUrls.length = 0;
  calledBodies.length = 0;
});

describe('CreateCircleModal', () => {
  test('renders nothing when closed', () => {
    renderWithProviders(<CreateCircleModal isOpen={false} onClose={() => {}} />, {
      route: '/circles',
      path: '/circles',
    });
    expect(screen.queryByText('New Circle')).not.toBeInTheDocument();
  });

  test('shows a validation error for an empty name', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateCircleModal isOpen onClose={() => {}} />, {
      route: '/circles',
      path: '/circles',
    });
    await user.click(screen.getByRole('button', { name: 'Create Circle' }));
    expect(await screen.findByText('Give this circle a name')).toBeInTheDocument();
  });

  test('submits valid input and closes on success', async () => {
    mockApi({ '/api/circles': { body: { circle: CREATED_CIRCLE }, status: 201 } });
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<CreateCircleModal isOpen onClose={onClose} />, {
      route: '/circles',
      path: '/circles',
    });

    await user.type(screen.getByLabelText('Circle name'), 'The Sterling Family');
    await user.type(screen.getByLabelText('Description'), 'Reunion crew');
    await user.click(screen.getByRole('button', { name: 'Create Circle' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(calledBodies[0]).toEqual({
      name: 'The Sterling Family',
      description: 'Reunion crew',
    });
  });

  test('shows the character limit in the validation error for an over-long description', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateCircleModal isOpen onClose={() => {}} />, {
      route: '/circles',
      path: '/circles',
    });

    await user.type(screen.getByLabelText('Circle name'), 'The Sterling Family');
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'x'.repeat(301) },
    });
    await user.click(screen.getByRole('button', { name: 'Create Circle' }));

    expect(
      await screen.findByText('Description must be at most 300 characters')
    ).toBeInTheDocument();
  });

  test('accepts a description that only exceeds the limit before trimming', async () => {
    mockApi({ '/api/circles': { body: { circle: CREATED_CIRCLE }, status: 201 } });
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<CreateCircleModal isOpen onClose={onClose} />, {
      route: '/circles',
      path: '/circles',
    });

    await user.type(screen.getByLabelText('Circle name'), 'The Sterling Family');
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: `${'x'.repeat(300)}   ` },
    });
    await user.click(screen.getByRole('button', { name: 'Create Circle' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(
      screen.queryByText('Description must be at most 300 characters')
    ).not.toBeInTheDocument();
  });

  test('shows the API error message on failure', async () => {
    mockApi({ '/api/circles': { body: { error: 'name already exists' }, status: 400 } });
    const user = userEvent.setup();
    renderWithProviders(<CreateCircleModal isOpen onClose={() => {}} />, {
      route: '/circles',
      path: '/circles',
    });

    await user.type(screen.getByLabelText('Circle name'), 'Duplicate');
    await user.click(screen.getByRole('button', { name: 'Create Circle' }));

    expect(await screen.findByText('name already exists')).toBeInTheDocument();
  });

  test('the close button dismisses the modal', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<CreateCircleModal isOpen onClose={onClose} />, {
      route: '/circles',
      path: '/circles',
    });
    await user.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('ignores close attempts while the create request is still pending', async () => {
    let resolveRequest: (() => void) | undefined;
    vi.mocked(fetch).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = () =>
            resolve({
              ok: true,
              status: 201,
              json: () => Promise.resolve({ circle: CREATED_CIRCLE }),
            } as Response);
        })
    );
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<CreateCircleModal isOpen onClose={onClose} />, {
      route: '/circles',
      path: '/circles',
    });

    await user.type(screen.getByLabelText('Circle name'), 'The Sterling Family');
    await user.click(screen.getByRole('button', { name: 'Create Circle' }));
    await screen.findByRole('button', { name: 'Creating…' });

    await user.click(screen.getByLabelText('Close'));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('New Circle')).toBeInTheDocument();

    resolveRequest?.();
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});
