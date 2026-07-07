import { describe, test, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
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
  purpose: 'family_lineage',
  privacy: 'private',
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
    await user.click(screen.getByText('Academic Memories'));
    await user.click(screen.getByText('Restricted'));
    await user.click(screen.getByRole('button', { name: 'Create Circle' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(calledBodies[0]).toEqual({
      name: 'The Sterling Family',
      purpose: 'academic',
      privacy: 'restricted',
    });
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
});
