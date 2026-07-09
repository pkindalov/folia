import { describe, test, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
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

const PAGE_2 = {
  _id: 'p2',
  album: 'a1',
  filename: 'photo2.jpg',
  mimeType: 'image/jpeg',
  size: 1024,
  url: '/uploads/id1/a1/photo2.jpg',
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
      sharedWithCircle: null,
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

  test("the share-with-circle picker preserves the album's assigned circle even when it's off the fetched list", async () => {
    const restrictedAlbum = {
      album: { ...ALBUM.album, visibility: 'shared', sharedWithCircle: 'c99' },
    };
    const otherCircle = {
      _id: 'c1',
      name: 'Other Circle',
      owner: 'id1',
      ownerUsername: 'pan',
      members: [],
    };
    const assignedCircle = {
      _id: 'c99',
      name: 'Assigned Circle',
      owner: 'id1',
      ownerUsername: 'pan',
      members: [],
    };
    mockApi({
      'GET /api/users/me': { body: ME },
      'GET /api/albums/a1': { body: restrictedAlbum },
      'GET /api/circles/c99': { body: { circle: assignedCircle } },
      'GET /api/circles': { body: { circles: [otherCircle], total: 1, page: 1, limit: 12 } },
      'PUT /api/albums/a1': { body: restrictedAlbum },
    });
    const user = userEvent.setup();
    renderEdit();
    await waitFor(() =>
      expect(screen.getByLabelText(/volume title/i)).toHaveValue('Summer in the Valley')
    );

    expect(await screen.findByRole('option', { name: 'Assigned Circle' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Other Circle' })).toBeInTheDocument();

    // Not just present in the DOM — actually the <select>'s current value,
    // so a save that doesn't touch this field submits it unchanged instead
    // of silently reverting to "Open to any signed-in user" (null).
    expect(screen.getByRole('combobox')).toHaveValue('c99');

    await user.click(screen.getByRole('button', { name: /save changes/i }));
    const put = calls.find((c) => c.options?.method === 'PUT');
    expect(put).toBeDefined();
    expect(JSON.parse(put!.options!.body as string).sharedWithCircle).toBe('c99');
  });

  test("an Admin editing another user's album still sees the assigned circle as an option, even though they don't own it", async () => {
    const restrictedAlbum = {
      album: { ...ALBUM.album, owner: 'owner-id', visibility: 'shared', sharedWithCircle: 'c99' },
    };
    const assignedCircle = {
      _id: 'c99',
      name: "Owner's Circle",
      owner: 'owner-id',
      ownerUsername: 'someoneElse',
      members: [],
    };
    mockApi({
      'GET /api/users/me': { body: { user: { ...ME.user, roles: ['User', 'Admin'] } } },
      'GET /api/albums/a1': { body: restrictedAlbum },
      'GET /api/circles/c99': { body: { circle: assignedCircle } },
      'GET /api/circles': { body: { circles: [], total: 0, page: 1, limit: 12 } },
    });
    renderEdit();
    await waitFor(() =>
      expect(screen.getByLabelText(/volume title/i)).toHaveValue('Summer in the Valley')
    );

    // Without this option, the uncontrolled <select> has no matching value
    // for the album's actual sharedWithCircle, so it would render as "Open
    // to any signed-in user" and silently submit null (widening access) the
    // next time the Admin saves any unrelated field.
    expect(await screen.findByRole('option', { name: "Owner's Circle" })).toBeInTheDocument();
  });

  test("an Admin editing another user's album does not see their own circle as a selectable option", async () => {
    const restrictedAlbum = {
      album: { ...ALBUM.album, owner: 'owner-id', visibility: 'shared', sharedWithCircle: 'c99' },
    };
    const assignedCircle = {
      _id: 'c99',
      name: "Owner's Circle",
      owner: 'owner-id',
      ownerUsername: 'someoneElse',
      members: [],
    };
    const adminsOwnCircle = {
      _id: 'c1',
      name: "Admin's Circle",
      owner: 'id1',
      ownerUsername: 'pan',
      members: [],
    };
    mockApi({
      'GET /api/users/me': { body: { user: { ...ME.user, roles: ['User', 'Admin'] } } },
      'GET /api/albums/a1': { body: restrictedAlbum },
      'GET /api/circles/c99': { body: { circle: assignedCircle } },
      'GET /api/circles': {
        body: { circles: [adminsOwnCircle], total: 1, page: 1, limit: 12 },
      },
    });
    renderEdit();
    await waitFor(() =>
      expect(screen.getByLabelText(/volume title/i)).toHaveValue('Summer in the Valley')
    );

    // The Admin's own circle would fail the backend's ownership check if
    // picked for someone else's album, so it must not be offered here.
    expect(await screen.findByRole('option', { name: "Owner's Circle" })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: "Admin's Circle" })).not.toBeInTheDocument();
  });

  test('loads more circles into the picker when "Load more circles" is clicked', async () => {
    const restrictedAlbum = { album: { ...ALBUM.album, visibility: 'shared' } };
    const page1Circle = {
      _id: 'c1',
      name: 'Circle One',
      owner: 'id1',
      ownerUsername: 'pan',
      members: [],
    };
    const page2Circle = {
      _id: 'c2',
      name: 'Circle Two',
      owner: 'id1',
      ownerUsername: 'pan',
      members: [],
    };

    vi.mocked(fetch).mockImplementation((url) => {
      const path = String(url);
      calls.push({ url: path });
      if (path.includes('/api/users/me')) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(ME) } as Response);
      }
      if (path.endsWith('/api/albums/a1')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(restrictedAlbum),
        } as Response);
      }
      if (path.includes('/api/circles')) {
        const page = new URL(path, 'http://localhost').searchParams.get('page') ?? '1';
        const body =
          page === '2'
            ? { circles: [page2Circle], total: 13, page: 2, limit: 12 }
            : { circles: [page1Circle], total: 13, page: 1, limit: 12 };
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);
      }
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) } as Response);
    });

    const user = userEvent.setup();
    renderEdit();
    await waitFor(() =>
      expect(screen.getByLabelText(/volume title/i)).toHaveValue('Summer in the Valley')
    );

    expect(await screen.findByRole('option', { name: 'Circle One' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Circle Two' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /load more circles/i }));

    expect(await screen.findByRole('option', { name: 'Circle Two' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /load more circles/i })).not.toBeInTheDocument();
  });

  test('does not duplicate a circle in the picker when server-side ordering shifts between pages', async () => {
    // Circles are listed sorted by -updatedAt (a mutable field). If a circle
    // is updated concurrently between this tab's page-1 fetch and its
    // "load more" fetch of page 2, an item can shift position and be
    // returned on both pages — the picker must dedupe by id rather than
    // rendering it twice.
    const restrictedAlbum = { album: { ...ALBUM.album, visibility: 'shared' } };
    const circle = (id: string, name: string) => ({
      _id: id,
      name,
      owner: 'id1',
      ownerUsername: 'pan',
      members: [],
    });
    // Page 1 as cached by this tab: positions 1..12 of the old ordering.
    const page1 = Array.from({ length: 12 }, (_, i) => circle(`x${i + 1}`, `Circle ${i + 1}`));
    // Page 2, freshly fetched after a concurrent update shifted the last
    // item of page 1 ("Circle 12") down into page 2's first slot.
    const page2 = [circle('x12', 'Circle 12'), circle('x13', 'Circle 13')];

    vi.mocked(fetch).mockImplementation((url) => {
      const path = String(url);
      calls.push({ url: path });
      if (path.includes('/api/users/me')) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(ME) } as Response);
      }
      if (path.endsWith('/api/albums/a1')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(restrictedAlbum),
        } as Response);
      }
      if (path.includes('/api/circles')) {
        const page = new URL(path, 'http://localhost').searchParams.get('page') ?? '1';
        const body =
          page === '2'
            ? { circles: page2, total: 14, page: 2, limit: 12 }
            : { circles: page1, total: 13, page: 1, limit: 12 };
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);
      }
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) } as Response);
    });

    const user = userEvent.setup();
    renderEdit();
    await waitFor(() =>
      expect(screen.getByLabelText(/volume title/i)).toHaveValue('Summer in the Valley')
    );

    await screen.findByRole('option', { name: 'Circle 1' });
    await user.click(screen.getByRole('button', { name: /load more circles/i }));
    await screen.findByRole('option', { name: 'Circle 13' });

    const select = screen.getByRole('combobox');
    expect(within(select).getAllByRole('option', { name: 'Circle 12' })).toHaveLength(1);
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

  // A real backend reflects the mutation on the very next GET; a mock that
  // always returns the same fixed album would clobber the optimistic cache
  // update once useArchiveAlbum's invalidation triggers a refetch — so this
  // mock tracks archived state statefully, like the real endpoint does.
  function mockApiWithArchivedState(initialArchived: boolean) {
    let archived = initialArchived;
    vi.mocked(fetch).mockImplementation((url, options) => {
      const path = String(url);
      calls.push({ url: path, options });
      const method = options?.method ?? 'GET';
      if (path.includes('/api/users/me')) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(ME) } as Response);
      }
      if (path.endsWith('/api/albums/a1') && method === 'PUT') {
        archived = JSON.parse(options!.body as string).archived;
      }
      if (path.endsWith('/api/albums/a1')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ album: { ...ALBUM.album, archived } }),
        } as Response);
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Not found' }),
      } as Response);
    });
  }

  test('archives the volume', async () => {
    mockApiWithArchivedState(false);
    const user = userEvent.setup();
    renderEdit();
    await user.click(await screen.findByRole('button', { name: 'Archive volume' }));

    await waitFor(() => {
      const put = calls.find((c) => c.url.endsWith('/api/albums/a1') && c.options?.method === 'PUT');
      expect(put).toBeDefined();
      expect(JSON.parse(put!.options!.body as string)).toEqual({ archived: true });
    });
    expect(await screen.findByRole('button', { name: 'Restore from archive' })).toBeInTheDocument();
  });

  test('restores an archived volume', async () => {
    mockApiWithArchivedState(true);
    const user = userEvent.setup();
    renderEdit();
    await user.click(await screen.findByRole('button', { name: 'Restore from archive' }));

    await waitFor(() => {
      const put = calls.find((c) => c.url.endsWith('/api/albums/a1') && c.options?.method === 'PUT');
      expect(put).toBeDefined();
      expect(JSON.parse(put!.options!.body as string)).toEqual({ archived: false });
    });
    expect(await screen.findByRole('button', { name: 'Archive volume' })).toBeInTheDocument();
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

  test('saves a caption when the Save caption button is clicked', async () => {
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
    await user.click(
      await screen.findByRole('button', { name: /save caption for photo1\.jpg/i })
    );

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

    expect(
      screen.queryByRole('button', { name: /save caption for photo1\.jpg/i })
    ).not.toBeInTheDocument();
    expect(calls.some((c) => c.url.includes('/api/albums/a1/pages/p1') && c.options?.method === 'PUT')).toBe(
      false
    );
  });

  test('leaving the caption field without clicking Save does not save it', async () => {
    mockApi({
      'GET /api/users/me': { body: ME },
      'GET /api/albums/a1/pages': { body: { pages: [PAGE] } },
      'GET /api/albums/a1': { body: ALBUM },
    });
    const user = userEvent.setup();
    renderEdit();

    const captionField = await screen.findByLabelText(/caption for photo1\.jpg/i);
    await user.type(captionField, 'A day at the lake');
    await user.tab();

    expect(calls.some((c) => c.url.includes('/api/albums/a1/pages/p1') && c.options?.method === 'PUT')).toBe(
      false
    );
    expect(
      await screen.findByRole('button', { name: /save caption for photo1\.jpg/i })
    ).toBeInTheDocument();
  });

  test('cannot fire a second caption save while the first is still in flight', async () => {
    let resolvePut!: (value: Response) => void;
    const putPromise = new Promise<Response>((resolve) => {
      resolvePut = resolve;
    });
    vi.mocked(fetch).mockImplementation((url, options) => {
      calls.push({ url: String(url), options });
      const method = options?.method ?? 'GET';
      const path = String(url);
      if (path.includes('/api/users/me')) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(ME) } as Response);
      }
      if (path.includes('/api/albums/a1/pages') && method === 'GET') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ pages: [PAGE] }),
        } as Response);
      }
      if (path.endsWith('/api/albums/a1') && method === 'GET') {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(ALBUM) } as Response);
      }
      if (path.includes('/api/albums/a1/pages/p1') && method === 'PUT') {
        return putPromise;
      }
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) } as Response);
    });

    const user = userEvent.setup();
    renderEdit();

    const captionField = await screen.findByLabelText(/caption for photo1\.jpg/i);
    await user.type(captionField, 'A day at the lake');
    const saveButton = await screen.findByRole('button', {
      name: /save caption for photo1\.jpg/i,
    });
    await user.click(saveButton);

    await waitFor(() => expect(saveButton).toBeDisabled());
    await user.click(saveButton);

    const putCallsInFlight = calls.filter(
      (c) => c.url.includes('/api/albums/a1/pages/p1') && c.options?.method === 'PUT'
    );
    expect(putCallsInFlight).toHaveLength(1);

    resolvePut({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ page: { ...PAGE, caption: 'A day at the lake' } }),
    } as Response);
  });

  test('saving one photo\'s caption does not re-enable a different photo\'s still-pending save button', async () => {
    let resolvePutP1!: (value: Response) => void;
    const putP1Promise = new Promise<Response>((resolve) => {
      resolvePutP1 = resolve;
    });

    vi.mocked(fetch).mockImplementation((url, options) => {
      calls.push({ url: String(url), options });
      const method = options?.method ?? 'GET';
      const path = String(url);
      if (path.includes('/api/users/me')) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(ME) } as Response);
      }
      if (path.includes('/api/albums/a1/pages') && method === 'GET') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ pages: [PAGE, PAGE_2] }),
        } as Response);
      }
      if (path.endsWith('/api/albums/a1') && method === 'GET') {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(ALBUM) } as Response);
      }
      if (path.includes('/api/albums/a1/pages/p1') && method === 'PUT') {
        return putP1Promise;
      }
      if (path.includes('/api/albums/a1/pages/p2') && method === 'PUT') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ page: { ...PAGE_2, caption: 'Second photo' } }),
        } as Response);
      }
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) } as Response);
    });

    const user = userEvent.setup();
    renderEdit();

    const captionField1 = await screen.findByLabelText(/caption for photo1\.jpg/i);
    await user.type(captionField1, 'A day at the lake');
    const saveButton1 = await screen.findByRole('button', { name: /save caption for photo1\.jpg/i });
    await user.click(saveButton1);
    await waitFor(() => expect(saveButton1).toBeDisabled());

    const captionField2 = await screen.findByLabelText(/caption for photo2\.jpg/i);
    await user.type(captionField2, 'Second photo');
    const saveButton2 = await screen.findByRole('button', { name: /save caption for photo2\.jpg/i });
    await user.click(saveButton2);

    // Photo 2's save resolves, but photo 1's request is still in flight —
    // photo 1's button must stay disabled/showing "Saving…" until its own
    // request settles, not clear just because a different photo's did.
    await waitFor(() => {
      const putP2 = calls.find(
        (c) => c.url.includes('/api/albums/a1/pages/p2') && c.options?.method === 'PUT'
      );
      expect(putP2).toBeDefined();
    });
    expect(screen.getByRole('button', { name: /save caption for photo1\.jpg/i })).toBeDisabled();

    resolvePutP1({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ page: { ...PAGE, caption: 'A day at the lake' } }),
    } as Response);
  });

  test('marks the earliest-uploaded photo as the cover by default', async () => {
    mockApi({
      'GET /api/users/me': { body: ME },
      'GET /api/albums/a1/pages': { body: { pages: [PAGE] } },
      'GET /api/albums/a1': { body: ALBUM },
    });
    renderEdit();
    const coverButton = await screen.findByRole('button', { name: 'This is the cover photo' });
    expect(coverButton).toBeDisabled();
  });

  test('sets a different photo as the cover', async () => {
    mockApi({
      'GET /api/users/me': { body: ME },
      'GET /api/albums/a1/pages': { body: { pages: [PAGE, PAGE_2] } },
      'GET /api/albums/a1': { body: ALBUM },
      'PUT /api/albums/a1/pages/p2/cover': {
        body: { album: { ...ALBUM.album, coverPage: 'p2', coverImage: PAGE_2.url } },
      },
    });
    const user = userEvent.setup();
    renderEdit();

    await user.click(await screen.findByRole('button', { name: /set photo2\.jpg as the cover/i }));

    await waitFor(() => {
      expect(
        calls.some(
          (c) => c.url.includes('/api/albums/a1/pages/p2/cover') && c.options?.method === 'PUT'
        )
      ).toBe(true);
    });
  });

  test('clicking a thumbnail opens it full-size in a lightbox', async () => {
    mockApi({
      'GET /api/users/me': { body: ME },
      'GET /api/albums/a1/pages': { body: { pages: [PAGE, PAGE_2] } },
      'GET /api/albums/a1': { body: ALBUM },
    });
    const user = userEvent.setup();
    renderEdit();

    await user.click(await screen.findByRole('button', { name: /view photo1\.jpg full size/i }));
    const dialog = await screen.findByRole('dialog', { name: /photo viewer/i });
    expect(within(dialog).getByAltText('photo1.jpg')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: /close photo viewer/i }));
    expect(screen.queryByRole('dialog', { name: /photo viewer/i })).not.toBeInTheDocument();
  });

  test('renders the chosen cover photo in the preview panel', async () => {
    mockApi({
      'GET /api/users/me': { body: ME },
      'GET /api/albums/a1/pages': { body: { pages: [PAGE] } },
      'GET /api/albums/a1': { body: { album: { ...ALBUM.album, coverImage: PAGE.url } } },
    });
    renderEdit();
    const previewImage = await screen.findAllByRole('presentation', { hidden: true });
    expect(previewImage.some((img) => img.getAttribute('src') === PAGE.url)).toBe(true);
  });
});
