import { describe, test, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route } from 'react-router-dom';
import EditorPage from './EditorPage';
import { tokenStorage } from '../../../lib/api-client';
import { renderWithProviders } from '../../../tests/test-utils';

const ME = { user: { _id: 'id1', username: 'pan', email: 'pan@test.com', roles: ['User'] } };

const ALBUM = {
  album: {
    _id: 'a1',
    title: 'Summer in the Valley',
    description: 'Holidays 2025',
    visibility: 'public',
    owner: 'id1',
    pageCount: 4,
  },
};

const PAGE = {
  _id: 'p1',
  album: 'a1',
  filename: 'photo1.jpg',
  mimeType: 'image/jpeg',
  size: 1024,
  url: '/uploads/id1/a1/photo1.jpg',
};

type Call = { url: string; options?: RequestInit };
const calls: Call[] = [];

function mockApi(routes: Record<string, { body: unknown; status?: number }>) {
  vi.mocked(fetch).mockImplementation((url, options) => {
    calls.push({ url: String(url), options });
    const method = options?.method ?? 'GET';
    const key = Object.keys(routes).find((k) => {
      const [m, suffix] = k.split(' ');
      return method === m && String(url).includes(suffix);
    });
    const { body, status = 200 } = routes[key ?? ''] ?? { body: { error: 'Not found' }, status: 404 };
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    } as Response);
  });
}

const renderNew = () =>
  renderWithProviders(<EditorPage />, {
    route: '/editor',
    path: '/editor',
    extraRoutes: <Route path="/editor/:id" element={<EditorPage />} />,
  });

const renderEdit = () =>
  renderWithProviders(<EditorPage />, {
    route: '/editor/a1',
    path: '/editor/:id',
    extraRoutes: <Route path="/flipbooks" element={<div>Gallery reached</div>} />,
  });

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  tokenStorage.set('jwt-ok');
  calls.length = 0;
});

describe('EditorPage — create', () => {
  test('validates the title before calling the API', async () => {
    mockApi({ 'GET /api/users/me': { body: ME } });
    const user = userEvent.setup();
    renderNew();
    await user.click(await screen.findByRole('button', { name: /create volume/i }));
    expect(await screen.findByText('Give this volume a title')).toBeInTheDocument();
    expect(calls.some((c) => c.url.includes('/api/albums'))).toBe(false);
  });

  test('creates an album and stays in the editor with pages unlocked', async () => {
    mockApi({
      'GET /api/users/me': { body: ME },
      'POST /api/albums': { body: ALBUM, status: 201 },
      'GET /api/albums/a1/pages': { body: { pages: [] } },
      'GET /api/albums/a1': { body: ALBUM },
    });
    const user = userEvent.setup();
    renderNew();

    await user.type(await screen.findByLabelText(/volume title/i), 'Summer in the Valley');
    await user.type(screen.getByLabelText(/description/i), 'Holidays 2025');
    await user.click(screen.getByLabelText(/public — community table/i));
    await user.click(screen.getByRole('button', { name: /create volume/i }));

    expect(await screen.findByText('Save changes')).toBeInTheDocument();
    expect(await screen.findByText(/drop the first pages of this volume here/i)).toBeInTheDocument();
    const post = calls.find((c) => c.options?.method === 'POST');
    expect(post).toBeDefined();
    expect(JSON.parse(post!.options!.body as string)).toEqual({
      title: 'Summer in the Valley',
      description: 'Holidays 2025',
      visibility: 'public',
    });
  });

  test('surfaces server errors', async () => {
    mockApi({
      'GET /api/users/me': { body: ME },
      'POST /api/albums': { body: { error: 'title is required' }, status: 400 },
    });
    const user = userEvent.setup();
    renderNew();
    await user.type(await screen.findByLabelText(/volume title/i), 'X');
    await user.click(screen.getByRole('button', { name: /create volume/i }));
    expect(await screen.findByText('title is required')).toBeInTheDocument();
  });
});

describe('EditorPage — edit', () => {
  test('loads the album into the form', async () => {
    mockApi({
      'GET /api/users/me': { body: ME },
      'GET /api/albums/a1': { body: ALBUM },
    });
    renderEdit();
    await waitFor(() =>
      expect(screen.getByLabelText(/volume title/i)).toHaveValue('Summer in the Valley')
    );
    expect(screen.getByLabelText(/description/i)).toHaveValue('Holidays 2025');
    expect(screen.getByLabelText(/public — community table/i)).toBeChecked();
  });

  test('saves changes with PUT and returns to the gallery', async () => {
    mockApi({
      'GET /api/users/me': { body: ME },
      'GET /api/albums/a1': { body: ALBUM },
      'PUT /api/albums/a1': { body: ALBUM },
    });
    const user = userEvent.setup();
    renderEdit();
    const title = await screen.findByLabelText(/volume title/i);
    await waitFor(() => expect(title).toHaveValue('Summer in the Valley'));

    await user.clear(title);
    await user.type(title, 'Renamed Volume');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByText('Gallery reached')).toBeInTheDocument();
    const put = calls.find((c) => c.options?.method === 'PUT');
    expect(put).toBeDefined();
    expect(JSON.parse(put!.options!.body as string).title).toBe('Renamed Volume');
  });

  test('delete asks for confirmation and calls DELETE', async () => {
    mockApi({
      'GET /api/users/me': { body: ME },
      'GET /api/albums/a1': { body: ALBUM },
      'DELETE /api/albums/a1': { body: { deleted: true } },
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    renderEdit();
    await user.click(await screen.findByRole('button', { name: /delete volume/i }));

    expect(window.confirm).toHaveBeenCalled();
    expect(await screen.findByText('Gallery reached')).toBeInTheDocument();
    expect(calls.some((c) => c.options?.method === 'DELETE')).toBe(true);
  });

  test('declining the confirmation keeps the album', async () => {
    mockApi({
      'GET /api/users/me': { body: ME },
      'GET /api/albums/a1': { body: ALBUM },
    });
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    renderEdit();
    await user.click(await screen.findByRole('button', { name: /delete volume/i }));
    expect(calls.some((c) => c.options?.method === 'DELETE')).toBe(false);
    expect(screen.queryByText('Gallery reached')).not.toBeInTheDocument();
  });
});

describe('EditorPage — pages panel', () => {
  test('locked before the volume is first saved: no file input, no dropzone copy', async () => {
    mockApi({ 'GET /api/users/me': { body: ME } });
    const { container } = renderNew();
    expect(
      await screen.findByText('Save this volume first to add its pages.')
    ).toBeInTheDocument();
    expect(screen.queryByText(/drop the first pages/i)).not.toBeInTheDocument();
    expect(container.querySelector('input[type="file"]')).not.toBeInTheDocument();
  });

  test('renders existing thumbnails when editing an album with pages', async () => {
    mockApi({
      'GET /api/users/me': { body: ME },
      'GET /api/albums/a1/pages': { body: { pages: [PAGE] } },
      'GET /api/albums/a1': { body: ALBUM },
    });
    renderEdit();
    const thumbnail = await screen.findByAltText('photo1.jpg');
    expect(thumbnail).toHaveAttribute('src', '/uploads/id1/a1/photo1.jpg');
    expect(screen.getByRole('button', { name: /remove photo1\.jpg/i })).toBeInTheDocument();
  });

  test('uploads a selected photo as multipart form data', async () => {
    mockApi({
      'GET /api/users/me': { body: ME },
      'GET /api/albums/a1/pages': { body: { pages: [] } },
      'GET /api/albums/a1': { body: ALBUM },
      'POST /api/albums/a1/pages': { body: { pages: [PAGE], pageCount: 1 }, status: 201 },
    });
    const user = userEvent.setup();
    const { container } = renderEdit();
    await screen.findByText(/drop the first pages of this volume here/i);

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['fake-bytes'], 'photo1.jpg', { type: 'image/jpeg' });
    await user.upload(input, file);

    await waitFor(() => {
      const post = calls.find((c) => c.url.includes('/api/albums/a1/pages') && c.options?.method === 'POST');
      expect(post).toBeDefined();
      expect(post!.options!.body).toBeInstanceOf(FormData);
      expect((post!.options!.body as FormData).getAll('photos')).toEqual([file]);
    });
  });

  test('rejects an unsupported file type client-side without calling the API', async () => {
    mockApi({
      'GET /api/users/me': { body: ME },
      'GET /api/albums/a1/pages': { body: { pages: [] } },
      'GET /api/albums/a1': { body: ALBUM },
    });
    // The accept attribute only hints at the OS file picker — files dropped
    // or picked through a picker that ignores it still reach the input, so
    // this bypasses userEvent's accept-based filtering to exercise the
    // app's own client-side validation, the real safety net here.
    const user = userEvent.setup({ applyAccept: false });
    const { container } = renderEdit();
    await screen.findByText(/drop the first pages of this volume here/i);

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['not an image'], 'notes.txt', { type: 'text/plain' });
    await user.upload(input, file);

    expect(await screen.findByText(/only JPEG, PNG, WEBP, or GIF photos are supported/i)).toBeInTheDocument();
    expect(calls.some((c) => c.url.includes('/api/albums/a1/pages') && c.options?.method === 'POST')).toBe(false);
  });

  test('removes a photo after confirmation', async () => {
    mockApi({
      'GET /api/users/me': { body: ME },
      'GET /api/albums/a1/pages': { body: { pages: [PAGE] } },
      'GET /api/albums/a1': { body: ALBUM },
      'DELETE /api/albums/a1/pages/p1': { body: { deleted: true, pageCount: 0 } },
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    renderEdit();

    await user.click(await screen.findByRole('button', { name: /remove photo1\.jpg/i }));
    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => {
      expect(calls.some((c) => c.url.includes('/api/albums/a1/pages/p1') && c.options?.method === 'DELETE')).toBe(true);
    });
  });

  test('surfaces an error when removing a photo fails', async () => {
    mockApi({
      'GET /api/users/me': { body: ME },
      'GET /api/albums/a1/pages': { body: { pages: [PAGE] } },
      'GET /api/albums/a1': { body: ALBUM },
      'DELETE /api/albums/a1/pages/p1': { body: { error: 'Photo not found' }, status: 404 },
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    renderEdit();

    await user.click(await screen.findByRole('button', { name: /remove photo1\.jpg/i }));
    expect(await screen.findByText('Photo not found')).toBeInTheDocument();
  });

  test('saves a caption when the field loses focus', async () => {
    mockApi({
      'GET /api/users/me': { body: ME },
      'GET /api/albums/a1/pages': { body: { pages: [PAGE] } },
      'GET /api/albums/a1': { body: ALBUM },
      'PUT /api/albums/a1/pages/p1': {
        body: { page: { ...PAGE, caption: 'A day at the lake' } },
      },
    });
    const user = userEvent.setup();
    renderEdit();

    const captionField = await screen.findByLabelText(/caption for photo1\.jpg/i);
    await user.type(captionField, 'A day at the lake');
    await user.tab();

    await waitFor(() => {
      const put = calls.find(
        (c) => c.url.includes('/api/albums/a1/pages/p1') && c.options?.method === 'PUT'
      );
      expect(put).toBeDefined();
      expect(JSON.parse(put!.options!.body as string)).toEqual({ caption: 'A day at the lake' });
    });
  });

  test('does not save the caption when it is unchanged', async () => {
    mockApi({
      'GET /api/users/me': { body: ME },
      'GET /api/albums/a1/pages': { body: { pages: [PAGE] } },
      'GET /api/albums/a1': { body: ALBUM },
    });
    const user = userEvent.setup();
    renderEdit();

    const captionField = await screen.findByLabelText(/caption for photo1\.jpg/i);
    await user.click(captionField);
    await user.tab();

    expect(calls.some((c) => c.url.includes('/api/albums/a1/pages/p1') && c.options?.method === 'PUT')).toBe(
      false
    );
  });
});
