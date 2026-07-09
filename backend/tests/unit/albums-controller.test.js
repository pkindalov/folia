jest.mock('../../server/utilities/storage', () => ({
  albumDir: jest.fn(),
  ensureAlbumDir: jest.fn(),
  removeAlbumDir: jest.fn(),
  photoUrl: jest.fn((ownerId, albumId, filename) => `/uploads/${ownerId}/${albumId}/${filename}`),
}));

const Album = require('../../server/data/Album');
const Page = require('../../server/data/Page');
const User = require('../../server/data/User');
const Circle = require('../../server/data/Circle');
const storage = require('../../server/utilities/storage');
const controller = require('../../server/controllers/albums-controller');

const flush = () => new Promise(setImmediate);

const OWNER_ID = '507f1f77bcf86cd799439011';
const OTHER_ID = '507f1f77bcf86cd799439022';
const ALBUM_ID = '507f191e810c19729de860ea';
const PAGE_ID = '507f191e810c19729de860eb';

const owner = { _id: OWNER_ID, username: 'pan', roles: ['User'] };
const stranger = { _id: OTHER_ID, username: 'maria', roles: ['User'] };
const admin = { _id: OTHER_ID, username: 'root', roles: ['Admin'] };

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const fakeAlbum = (overrides = {}) => ({
  _id: ALBUM_ID,
  title: 'Summer',
  description: '',
  visibility: 'private',
  owner: { toString: () => OWNER_ID },
  coverPage: null,
  save: jest.fn().mockImplementation(function () {
    return Promise.resolve(this);
  }),
  deleteOne: jest.fn().mockResolvedValue({}),
  toJSON: function () {
    const { toJSON: _drop, save: _drop2, deleteOne: _drop3, ...rest } = this;
    return rest;
  },
  ...overrides,
});

// No pages at all: both the single-album and batched cover lookups resolve
// to nothing.
const mockNoPages = () => {
  jest.spyOn(Page, 'findOne').mockReturnValue({ sort: jest.fn().mockResolvedValue(null) });
  jest.spyOn(Page, 'find').mockResolvedValue([]);
  jest.spyOn(Page, 'aggregate').mockResolvedValue([]);
};

beforeEach(() => {
  mockNoPages();
});

describe('albums-controller', () => {
  describe('create — validation', () => {
    test.each([
      ['empty body', {}],
      ['missing title', { description: 'x' }],
      ['empty title', { title: '' }],
      ['whitespace-only title', { title: '   ' }],
      ['non-string title (injection)', { title: { $gt: '' } }],
      ['number title', { title: 42 }],
      ['title over 120 chars', { title: 'x'.repeat(121) }],
      ['non-string description', { title: 'ok', description: 42 }],
      ['description over 2000 chars', { title: 'ok', description: 'x'.repeat(2001) }],
      ['invalid visibility', { title: 'ok', visibility: 'friends-only' }],
      ['non-string visibility', { title: 'ok', visibility: 1 }],
      ['non-ObjectId sharedWithCircle', { title: 'ok', sharedWithCircle: 'not-an-id' }],
    ])('rejects %s with 400', (_name, body) => {
      const create = jest.spyOn(Album, 'create');
      const res = mockRes();
      controller.create({ body, user: owner }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(create).not.toHaveBeenCalled();
    });

    test('accepts boundary values (120-char title, 2000-char description)', async () => {
      jest.spyOn(Album, 'create').mockResolvedValue(fakeAlbum());
      const res = mockRes();
      controller.create(
        { body: { title: 'x'.repeat(120), description: 'y'.repeat(2000) }, user: owner },
        res
      );
      await flush();
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('create — behavior', () => {
    test('sets the owner from the authenticated user, never from the body', async () => {
      const create = jest.spyOn(Album, 'create').mockResolvedValue(fakeAlbum());
      controller.create(
        { body: { title: 'Summer', owner: OTHER_ID }, user: owner },
        mockRes()
      );
      await flush();
      expect(create.mock.calls[0][0].owner).toBe(OWNER_ID);
    });

    test('trims the title and defaults visibility to private', async () => {
      const create = jest.spyOn(Album, 'create').mockResolvedValue(fakeAlbum());
      controller.create({ body: { title: '  Summer  ' }, user: owner }, mockRes());
      await flush();
      expect(create.mock.calls[0][0].title).toBe('Summer');
      expect(create.mock.calls[0][0].visibility).toBe('private');
    });

    test('creates the per-user album upload folder', async () => {
      jest.spyOn(Album, 'create').mockResolvedValue(fakeAlbum());
      controller.create({ body: { title: 'Summer' }, user: owner }, mockRes());
      await flush();
      expect(storage.ensureAlbumDir).toHaveBeenCalledWith(OWNER_ID, ALBUM_ID);
    });

    test('responds 201 with the album and a null cover (it has no pages yet)', async () => {
      const album = fakeAlbum();
      jest.spyOn(Album, 'create').mockResolvedValue(album);
      const res = mockRes();
      controller.create({ body: { title: 'Summer' }, user: owner }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ album: { ...album.toJSON(), coverImage: null } });
    });

    test('rejects a sharedWithCircle that belongs to a circle the requester does not own', async () => {
      jest
        .spyOn(Circle, 'findById')
        .mockResolvedValue({ owner: { toString: () => OTHER_ID } });
      const create = jest.spyOn(Album, 'create');
      const res = mockRes();
      controller.create(
        {
          body: {
            title: 'Summer',
            visibility: 'shared',
            sharedWithCircle: '507f1f77bcf86cd799439099',
          },
          user: owner,
        },
        res
      );
      await flush();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(create).not.toHaveBeenCalled();
    });

    test('rejects a sharedWithCircle pointing at a nonexistent circle', async () => {
      jest.spyOn(Circle, 'findById').mockResolvedValue(null);
      const create = jest.spyOn(Album, 'create');
      const res = mockRes();
      controller.create(
        {
          body: {
            title: 'Summer',
            visibility: 'shared',
            sharedWithCircle: '507f1f77bcf86cd799439099',
          },
          user: owner,
        },
        res
      );
      await flush();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(create).not.toHaveBeenCalled();
    });

    test('accepts a sharedWithCircle the requester owns', async () => {
      jest.spyOn(Circle, 'findById').mockResolvedValue({ owner: { toString: () => OWNER_ID } });
      jest.spyOn(Album, 'create').mockResolvedValue(fakeAlbum({ sharedWithCircle: '507f1f77bcf86cd799439099' }));
      const res = mockRes();
      controller.create(
        {
          body: {
            title: 'Summer',
            visibility: 'shared',
            sharedWithCircle: '507f1f77bcf86cd799439099',
          },
          user: owner,
        },
        res
      );
      await flush();
      expect(res.status).toHaveBeenCalledWith(201);
    });

    test('ignores a submitted sharedWithCircle when visibility is not shared', async () => {
      const create = jest.spyOn(Album, 'create').mockResolvedValue(fakeAlbum());
      const findById = jest.spyOn(Circle, 'findById');
      const res = mockRes();
      controller.create(
        { body: { title: 'Summer', sharedWithCircle: '507f1f77bcf86cd799439099' }, user: owner },
        res
      );
      await flush();
      expect(findById).not.toHaveBeenCalled();
      expect(create.mock.calls[0][0].sharedWithCircle).toBeNull();
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  // Album.find(...).sort(...).skip(...).limit(...) — a chainable mock query.
  function mockAlbumQuery(albums) {
    const query = {};
    query.sort = jest.fn().mockReturnValue(query);
    query.skip = jest.fn().mockReturnValue(query);
    query.limit = jest.fn().mockResolvedValue(albums);
    return query;
  }

  function mockFailingAlbumQuery(err) {
    const query = {};
    query.sort = jest.fn().mockReturnValue(query);
    query.skip = jest.fn().mockReturnValue(query);
    query.limit = jest.fn().mockRejectedValue(err);
    return query;
  }

  describe('list', () => {
    test('returns only the albums owned by the requester, paginated', async () => {
      const album = fakeAlbum();
      const find = jest.spyOn(Album, 'find').mockReturnValue(mockAlbumQuery([album]));
      jest.spyOn(Album, 'countDocuments').mockResolvedValue(1);
      const res = mockRes();
      controller.list({ user: owner, query: {} }, res);
      await flush();
      expect(find).toHaveBeenCalledWith({ owner: OWNER_ID, archived: { $ne: true } });
      expect(res.json).toHaveBeenCalledWith({
        albums: [{ ...album.toJSON(), coverImage: null }],
        total: 1,
        page: 1,
        limit: 12,
      });
    });

    test('excludes archived volumes from the main gallery', async () => {
      const find = jest.spyOn(Album, 'find').mockReturnValue(mockAlbumQuery([]));
      jest.spyOn(Album, 'countDocuments').mockResolvedValue(0);
      const res = mockRes();
      controller.list({ user: owner, query: {} }, res);
      await flush();
      expect(find).toHaveBeenCalledWith(
        expect.objectContaining({ archived: { $ne: true } })
      );
    });

    test('filters by visibility when requested', async () => {
      const find = jest.spyOn(Album, 'find').mockReturnValue(mockAlbumQuery([]));
      jest.spyOn(Album, 'countDocuments').mockResolvedValue(0);
      const res = mockRes();
      controller.list({ user: owner, query: { visibility: 'public' } }, res);
      await flush();
      expect(find).toHaveBeenCalledWith({
        owner: OWNER_ID,
        archived: { $ne: true },
        visibility: 'public',
      });
    });

    test('rejects an invalid visibility filter', () => {
      const find = jest.spyOn(Album, 'find');
      const res = mockRes();
      controller.list({ user: owner, query: { visibility: 'nope' } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(find).not.toHaveBeenCalled();
    });

    test('skips to the requested page', async () => {
      const query = mockAlbumQuery([]);
      jest.spyOn(Album, 'find').mockReturnValue(query);
      jest.spyOn(Album, 'countDocuments').mockResolvedValue(30);
      const res = mockRes();
      controller.list({ user: owner, query: { page: '3' } }, res);
      await flush();
      expect(query.skip).toHaveBeenCalledWith(24); // (3 - 1) * 12
      expect(query.limit).toHaveBeenCalledWith(12);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ page: 3, total: 30 }));
    });

    test('falls back to page 1 for a garbage page value', async () => {
      const query = mockAlbumQuery([]);
      jest.spyOn(Album, 'find').mockReturnValue(query);
      jest.spyOn(Album, 'countDocuments').mockResolvedValue(0);
      const res = mockRes();
      controller.list({ user: owner, query: { page: 'not-a-number' } }, res);
      await flush();
      expect(query.skip).toHaveBeenCalledWith(0);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));
    });

    test('returns 500 when the query fails', async () => {
      jest.spyOn(Album, 'find').mockReturnValue(mockFailingAlbumQuery(new Error('x')));
      jest.spyOn(Album, 'countDocuments').mockResolvedValue(0);
      const res = mockRes();
      controller.list({ user: owner, query: {} }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(500);
    });

    test('uses the earliest-uploaded photo as the cover when none was explicitly chosen', async () => {
      const album = fakeAlbum();
      jest.spyOn(Album, 'find').mockReturnValue(mockAlbumQuery([album]));
      jest.spyOn(Album, 'countDocuments').mockResolvedValue(1);
      jest.spyOn(Page, 'aggregate').mockResolvedValue([{ _id: ALBUM_ID, filename: 'first.jpg' }]);
      const res = mockRes();
      controller.list({ user: owner, query: {} }, res);
      await flush();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          albums: [
            { ...album.toJSON(), coverImage: `/uploads/${OWNER_ID}/${ALBUM_ID}/first.jpg` },
          ],
        })
      );
    });

    test('uses the explicitly chosen cover photo when set', async () => {
      const album = fakeAlbum({ coverPage: PAGE_ID });
      jest.spyOn(Album, 'find').mockReturnValue(mockAlbumQuery([album]));
      jest.spyOn(Album, 'countDocuments').mockResolvedValue(1);
      const findPages = jest
        .spyOn(Page, 'find')
        .mockResolvedValue([{ _id: PAGE_ID, album: ALBUM_ID, filename: 'chosen.jpg' }]);
      const res = mockRes();
      controller.list({ user: owner, query: {} }, res);
      await flush();
      expect(findPages).toHaveBeenCalledWith({ _id: { $in: [PAGE_ID] } });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          albums: [
            { ...album.toJSON(), coverImage: `/uploads/${OWNER_ID}/${ALBUM_ID}/chosen.jpg` },
          ],
        })
      );
    });

    test('falls back to the earliest photo when the chosen cover belongs to a different album', async () => {
      const album = fakeAlbum({ coverPage: PAGE_ID });
      jest.spyOn(Album, 'find').mockReturnValue(mockAlbumQuery([album]));
      jest.spyOn(Album, 'countDocuments').mockResolvedValue(1);
      jest
        .spyOn(Page, 'find')
        .mockResolvedValue([{ _id: PAGE_ID, album: 'some-other-album', filename: 'wrong.jpg' }]);
      jest.spyOn(Page, 'aggregate').mockResolvedValue([{ _id: ALBUM_ID, filename: 'first.jpg' }]);
      const res = mockRes();
      controller.list({ user: owner, query: {} }, res);
      await flush();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          albums: [
            { ...album.toJSON(), coverImage: `/uploads/${OWNER_ID}/${ALBUM_ID}/first.jpg` },
          ],
        })
      );
    });
  });

  describe('listPublic', () => {
    test('returns public albums across all owners with their cover and username', async () => {
      const album = fakeAlbum({ visibility: 'public', owner: { toString: () => OWNER_ID } });
      jest.spyOn(Album, 'find').mockReturnValue(mockAlbumQuery([album]));
      jest.spyOn(Album, 'countDocuments').mockResolvedValue(1);
      jest.spyOn(User, 'find').mockResolvedValue([{ _id: OWNER_ID, username: 'pan' }]);
      jest.spyOn(Page, 'aggregate').mockResolvedValue([{ _id: ALBUM_ID, filename: 'first.jpg' }]);

      const res = mockRes();
      controller.listPublic({ query: {} }, res);
      await flush();

      expect(Album.find).toHaveBeenCalledWith({ visibility: 'public' });
      expect(res.json).toHaveBeenCalledWith({
        albums: [
          {
            ...album.toJSON(),
            ownerUsername: 'pan',
            coverImage: `/uploads/${OWNER_ID}/${ALBUM_ID}/first.jpg`,
          },
        ],
        total: 1,
        page: 1,
        limit: 12,
      });
    });

    test('falls back to a placeholder label when the owner was deleted', async () => {
      const album = fakeAlbum({ visibility: 'public', owner: { toString: () => OWNER_ID } });
      jest.spyOn(Album, 'find').mockReturnValue(mockAlbumQuery([album]));
      jest.spyOn(Album, 'countDocuments').mockResolvedValue(1);
      jest.spyOn(User, 'find').mockResolvedValue([]);

      const res = mockRes();
      controller.listPublic({ query: {} }, res);
      await flush();

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          albums: [expect.objectContaining({ ownerUsername: 'Deleted user' })],
        })
      );
    });

    test('skips to the requested page', async () => {
      const query = mockAlbumQuery([]);
      jest.spyOn(Album, 'find').mockReturnValue(query);
      jest.spyOn(Album, 'countDocuments').mockResolvedValue(30);
      jest.spyOn(User, 'find').mockResolvedValue([]);
      const res = mockRes();
      controller.listPublic({ query: { page: '2' } }, res);
      await flush();
      expect(query.skip).toHaveBeenCalledWith(12); // (2 - 1) * 12
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ page: 2, total: 30 }));
    });

    test('returns an empty list when there are no public albums', async () => {
      jest.spyOn(Album, 'find').mockReturnValue(mockAlbumQuery([]));
      jest.spyOn(Album, 'countDocuments').mockResolvedValue(0);
      const findUsers = jest.spyOn(User, 'find').mockResolvedValue([]);
      const res = mockRes();
      controller.listPublic({ query: {} }, res);
      await flush();
      expect(findUsers).toHaveBeenCalledWith({ _id: { $in: [] } }, 'username');
      expect(res.json).toHaveBeenCalledWith({ albums: [], total: 0, page: 1, limit: 12 });
    });

    test('returns 500 when the query fails', async () => {
      jest.spyOn(Album, 'find').mockReturnValue(mockFailingAlbumQuery(new Error('x')));
      jest.spyOn(Album, 'countDocuments').mockResolvedValue(0);
      const res = mockRes();
      controller.listPublic({ query: {} }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('listSharedWithMe', () => {
    test("returns albums shared with a circle the requester owns or belongs to, excluding the requester's own albums", async () => {
      jest.spyOn(Circle, 'find').mockResolvedValue([{ _id: 'c1' }, { _id: 'c2' }]);
      const album = fakeAlbum({ visibility: 'shared', sharedWithCircle: 'c1' });
      const find = jest.spyOn(Album, 'find').mockReturnValue(mockAlbumQuery([album]));
      jest.spyOn(Album, 'countDocuments').mockResolvedValue(1);
      jest.spyOn(User, 'find').mockResolvedValue([{ _id: OWNER_ID, username: 'pan' }]);

      const res = mockRes();
      controller.listSharedWithMe({ user: owner, query: {} }, res);
      await flush();

      expect(Circle.find).toHaveBeenCalledWith(
        {
          $or: [
            { owner: OWNER_ID },
            { members: { $elemMatch: { user: OWNER_ID, status: 'accepted' } } },
          ],
        },
        '_id'
      );
      expect(find).toHaveBeenCalledWith({
        visibility: 'shared',
        sharedWithCircle: { $in: ['c1', 'c2'] },
        owner: { $ne: OWNER_ID },
      });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ total: 1, albums: [expect.objectContaining({ ownerUsername: 'pan' })] })
      );
    });

    test('returns an empty list when the requester belongs to no circles', async () => {
      jest.spyOn(Circle, 'find').mockResolvedValue([]);
      const find = jest.spyOn(Album, 'find').mockReturnValue(mockAlbumQuery([]));
      jest.spyOn(Album, 'countDocuments').mockResolvedValue(0);
      jest.spyOn(User, 'find').mockResolvedValue([]);

      const res = mockRes();
      controller.listSharedWithMe({ user: owner, query: {} }, res);
      await flush();

      expect(find).toHaveBeenCalledWith(
        expect.objectContaining({ sharedWithCircle: { $in: [] } })
      );
      expect(res.json).toHaveBeenCalledWith({ albums: [], total: 0, page: 1, limit: 12 });
    });

    test('returns 500 when the circle lookup fails', async () => {
      jest.spyOn(Circle, 'find').mockRejectedValue(new Error('x'));
      const res = mockRes();
      controller.listSharedWithMe({ user: owner, query: {} }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(500);
    });

    test('returns 500 when the album query fails', async () => {
      jest.spyOn(Circle, 'find').mockResolvedValue([{ _id: 'c1' }]);
      jest.spyOn(Album, 'find').mockReturnValue(mockFailingAlbumQuery(new Error('x')));
      jest.spyOn(Album, 'countDocuments').mockResolvedValue(0);
      const res = mockRes();
      controller.listSharedWithMe({ user: owner, query: {} }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('listArchived', () => {
    test("returns only the requester's archived albums, paginated", async () => {
      const album = fakeAlbum({ archived: true });
      const find = jest.spyOn(Album, 'find').mockReturnValue(mockAlbumQuery([album]));
      jest.spyOn(Album, 'countDocuments').mockResolvedValue(1);
      const res = mockRes();
      controller.listArchived({ user: owner, query: {} }, res);
      await flush();
      expect(find).toHaveBeenCalledWith({ owner: OWNER_ID, archived: true });
      expect(res.json).toHaveBeenCalledWith({
        albums: [{ ...album.toJSON(), coverImage: null }],
        total: 1,
        page: 1,
        limit: 12,
      });
    });

    test('skips to the requested page', async () => {
      const query = mockAlbumQuery([]);
      jest.spyOn(Album, 'find').mockReturnValue(query);
      jest.spyOn(Album, 'countDocuments').mockResolvedValue(30);
      const res = mockRes();
      controller.listArchived({ user: owner, query: { page: '2' } }, res);
      await flush();
      expect(query.skip).toHaveBeenCalledWith(12);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ page: 2, total: 30 }));
    });

    test('returns 500 when the query fails', async () => {
      jest.spyOn(Album, 'find').mockReturnValue(mockFailingAlbumQuery(new Error('x')));
      jest.spyOn(Album, 'countDocuments').mockResolvedValue(0);
      const res = mockRes();
      controller.listArchived({ user: owner, query: {} }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getOne', () => {
    test('404 for a malformed id (no DB hit)', () => {
      const findById = jest.spyOn(Album, 'findById');
      const res = mockRes();
      controller.getOne({ params: { id: 'not-an-objectid' }, user: owner }, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(findById).not.toHaveBeenCalled();
    });

    test('404 when the album does not exist', async () => {
      jest.spyOn(Album, 'findById').mockResolvedValue(null);
      const res = mockRes();
      controller.getOne({ params: { id: ALBUM_ID }, user: owner }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('403 when a stranger requests a private album', async () => {
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      const res = mockRes();
      controller.getOne({ params: { id: ALBUM_ID }, user: stranger }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('owner can read their private album', async () => {
      const album = fakeAlbum();
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      const res = mockRes();
      controller.getOne({ params: { id: ALBUM_ID }, user: owner }, res);
      await flush();
      expect(res.json).toHaveBeenCalledWith({ album: { ...album.toJSON(), coverImage: null } });
    });

    test('a stranger can read a public album', async () => {
      const album = fakeAlbum({ visibility: 'public' });
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      const res = mockRes();
      controller.getOne({ params: { id: ALBUM_ID }, user: stranger }, res);
      await flush();
      expect(res.json).toHaveBeenCalledWith({ album: { ...album.toJSON(), coverImage: null } });
    });

    test('an Admin can read any private album', async () => {
      const album = fakeAlbum();
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      const res = mockRes();
      controller.getOne({ params: { id: ALBUM_ID }, user: admin }, res);
      await flush();
      expect(res.json).toHaveBeenCalledWith({ album: { ...album.toJSON(), coverImage: null } });
    });

    test('a stranger can read a shared album with no circle attached (legacy behavior)', async () => {
      const album = fakeAlbum({ visibility: 'shared', sharedWithCircle: null });
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      const res = mockRes();
      controller.getOne({ params: { id: ALBUM_ID }, user: stranger }, res);
      await flush();
      expect(res.status).not.toHaveBeenCalledWith(403);
    });

    test('a circle member can read an album shared with their circle', async () => {
      const album = fakeAlbum({ visibility: 'shared', sharedWithCircle: '507f1f77bcf86cd799439099' });
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      jest.spyOn(Circle, 'findById').mockResolvedValue(
        new Circle({
          name: 'Family',
          owner: OWNER_ID,
          members: [{ user: OTHER_ID, status: 'accepted' }],
        })
      );
      const res = mockRes();
      controller.getOne({ params: { id: ALBUM_ID }, user: stranger }, res);
      await flush();
      expect(res.status).not.toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ album: { ...album.toJSON(), coverImage: null } });
    });

    test('a non-member gets 403 for an album shared with a circle they are not in', async () => {
      const album = fakeAlbum({ visibility: 'shared', sharedWithCircle: '507f1f77bcf86cd799439099' });
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      jest.spyOn(Circle, 'findById').mockResolvedValue(
        new Circle({ name: 'Family', owner: OWNER_ID, members: [] })
      );
      const res = mockRes();
      controller.getOne({ params: { id: ALBUM_ID }, user: stranger }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('a dangling circle reference (deleted circle) is treated as no access', async () => {
      const album = fakeAlbum({ visibility: 'shared', sharedWithCircle: '507f1f77bcf86cd799439099' });
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      jest.spyOn(Circle, 'findById').mockResolvedValue(null);
      const res = mockRes();
      controller.getOne({ params: { id: ALBUM_ID }, user: stranger }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('the album owner can always read their shared album regardless of circle', async () => {
      const album = fakeAlbum({ visibility: 'shared', sharedWithCircle: '507f1f77bcf86cd799439099' });
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      const findById = jest.spyOn(Circle, 'findById');
      const res = mockRes();
      controller.getOne({ params: { id: ALBUM_ID }, user: owner }, res);
      await flush();
      expect(findById).not.toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalledWith(403);
    });
  });

  describe('update', () => {
    test('403 when a non-owner tries to update', async () => {
      const album = fakeAlbum();
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      const res = mockRes();
      controller.update({ params: { id: ALBUM_ID }, body: { title: 'New' }, user: stranger }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(album.save).not.toHaveBeenCalled();
    });

    test('404 for a missing album', async () => {
      jest.spyOn(Album, 'findById').mockResolvedValue(null);
      const res = mockRes();
      controller.update({ params: { id: ALBUM_ID }, body: { title: 'New' }, user: owner }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('rejects invalid partial input before touching the DB', () => {
      const findById = jest.spyOn(Album, 'findById');
      const res = mockRes();
      controller.update(
        { params: { id: ALBUM_ID }, body: { visibility: 'nope' }, user: owner },
        res
      );
      expect(res.status).toHaveBeenCalledWith(400);
      expect(findById).not.toHaveBeenCalled();
    });

    test('partial update: only provided fields change', async () => {
      const album = fakeAlbum({ title: 'Old', visibility: 'private' });
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      const res = mockRes();
      controller.update(
        { params: { id: ALBUM_ID }, body: { visibility: 'public' }, user: owner },
        res
      );
      await flush();
      expect(album.title).toBe('Old');
      expect(album.visibility).toBe('public');
      expect(album.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ album: { ...album.toJSON(), coverImage: null } });
    });

    test('rejects setting sharedWithCircle to a circle the requester does not own', async () => {
      const album = fakeAlbum({ visibility: 'shared' });
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      jest
        .spyOn(Circle, 'findById')
        .mockResolvedValue({ owner: { toString: () => OTHER_ID } });
      const res = mockRes();
      controller.update(
        { params: { id: ALBUM_ID }, body: { sharedWithCircle: '507f1f77bcf86cd799439099' }, user: owner },
        res
      );
      await flush();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(album.save).not.toHaveBeenCalled();
    });

    test('accepts setting sharedWithCircle to a circle the requester owns', async () => {
      const album = fakeAlbum({ visibility: 'shared' });
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      jest.spyOn(Circle, 'findById').mockResolvedValue({ owner: { toString: () => OWNER_ID } });
      const res = mockRes();
      controller.update(
        { params: { id: ALBUM_ID }, body: { sharedWithCircle: '507f1f77bcf86cd799439099' }, user: owner },
        res
      );
      await flush();
      expect(album.sharedWithCircle).toBe('507f1f77bcf86cd799439099');
      expect(album.save).toHaveBeenCalled();
    });

    test('rejects an Admin setting a new sharedWithCircle to a circle the Admin owns but the album owner does not', async () => {
      // The album belongs to `owner`; the Admin must not be able to redirect
      // it to a circle the Admin themselves owns — that would silently grant
      // the Admin's own circle members access to a stranger's private album.
      const album = fakeAlbum({ visibility: 'shared' });
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      jest.spyOn(Circle, 'findById').mockResolvedValue({ owner: { toString: () => OTHER_ID } });
      const res = mockRes();
      controller.update(
        {
          params: { id: ALBUM_ID },
          body: { sharedWithCircle: '507f1f77bcf86cd799439099' },
          user: admin,
        },
        res
      );
      await flush();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(album.save).not.toHaveBeenCalled();
    });

    test('an Admin editing an unrelated field does not re-verify an already-stored sharedWithCircle they do not own', async () => {
      // The circle is owned by the album's real owner, not by the Admin
      // making this request — verifySharedCircleOwnership would reject it if
      // it were (wrongly) re-run against req.user for an untouched value.
      const album = fakeAlbum({
        visibility: 'shared',
        sharedWithCircle: '507f1f77bcf86cd799439099',
      });
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      const findById = jest.spyOn(Circle, 'findById');
      const res = mockRes();
      controller.update(
        { params: { id: ALBUM_ID }, body: { description: 'new description' }, user: admin },
        res
      );
      await flush();
      expect(findById).not.toHaveBeenCalled();
      expect(album.description).toBe('new description');
      expect(album.sharedWithCircle).toBe('507f1f77bcf86cd799439099');
      expect(res.status).not.toHaveBeenCalledWith(400);
      expect(album.save).toHaveBeenCalled();
    });

    test('clears sharedWithCircle when visibility moves away from shared', async () => {
      const album = fakeAlbum({ visibility: 'shared', sharedWithCircle: '507f1f77bcf86cd799439099' });
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      const findById = jest.spyOn(Circle, 'findById');
      const res = mockRes();
      controller.update(
        { params: { id: ALBUM_ID }, body: { visibility: 'private' }, user: owner },
        res
      );
      await flush();
      expect(findById).not.toHaveBeenCalled();
      expect(album.sharedWithCircle).toBeNull();
      expect(album.save).toHaveBeenCalled();
    });

    test('ignores a submitted sharedWithCircle when visibility is not shared', async () => {
      const album = fakeAlbum({ visibility: 'private' });
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      const findById = jest.spyOn(Circle, 'findById');
      const res = mockRes();
      controller.update(
        {
          params: { id: ALBUM_ID },
          body: { sharedWithCircle: '507f1f77bcf86cd799439099' },
          user: owner,
        },
        res
      );
      await flush();
      expect(findById).not.toHaveBeenCalled();
      expect(album.sharedWithCircle).toBeNull();
      expect(res.status).not.toHaveBeenCalledWith(400);
    });

    test('rejects a non-boolean archived value', () => {
      const findById = jest.spyOn(Album, 'findById');
      const res = mockRes();
      controller.update(
        { params: { id: ALBUM_ID }, body: { archived: 'yes' }, user: owner },
        res
      );
      expect(res.status).toHaveBeenCalledWith(400);
      expect(findById).not.toHaveBeenCalled();
    });

    test('archives a volume', async () => {
      const album = fakeAlbum({ archived: false });
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      const res = mockRes();
      controller.update(
        { params: { id: ALBUM_ID }, body: { archived: true }, user: owner },
        res
      );
      await flush();
      expect(album.archived).toBe(true);
      expect(album.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        album: { ...album.toJSON(), coverImage: null },
      });
    });

    test('restores an archived volume', async () => {
      const album = fakeAlbum({ archived: true });
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      const res = mockRes();
      controller.update(
        { params: { id: ALBUM_ID }, body: { archived: false }, user: owner },
        res
      );
      await flush();
      expect(album.archived).toBe(false);
    });

    test('owner can rename (title trimmed)', async () => {
      const album = fakeAlbum();
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      controller.update(
        { params: { id: ALBUM_ID }, body: { title: '  Renamed  ' }, user: owner },
        mockRes()
      );
      await flush();
      expect(album.title).toBe('Renamed');
    });
  });

  describe('remove', () => {
    test('403 when a non-owner tries to delete', async () => {
      const album = fakeAlbum();
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      const res = mockRes();
      controller.remove({ params: { id: ALBUM_ID }, user: stranger }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(album.deleteOne).not.toHaveBeenCalled();
      expect(storage.removeAlbumDir).not.toHaveBeenCalled();
    });

    test('deletes the album, its pages, and its upload folder', async () => {
      const album = fakeAlbum();
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      const deleteMany = jest.spyOn(Page, 'deleteMany').mockResolvedValue({});
      const res = mockRes();
      controller.remove({ params: { id: ALBUM_ID }, user: owner }, res);
      await flush();
      expect(album.deleteOne).toHaveBeenCalled();
      expect(deleteMany).toHaveBeenCalledWith({ album: ALBUM_ID });
      expect(storage.removeAlbumDir).toHaveBeenCalledWith(album.owner, ALBUM_ID);
      expect(res.json).toHaveBeenCalledWith({ deleted: true });
    });

    test('an Admin can delete any album', async () => {
      const album = fakeAlbum();
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      jest.spyOn(Page, 'deleteMany').mockResolvedValue({});
      const res = mockRes();
      controller.remove({ params: { id: ALBUM_ID }, user: admin }, res);
      await flush();
      expect(album.deleteOne).toHaveBeenCalled();
    });

    test('404 for malformed id, no deletion attempted', () => {
      const findById = jest.spyOn(Album, 'findById');
      const res = mockRes();
      controller.remove({ params: { id: '../../etc' }, user: owner }, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(findById).not.toHaveBeenCalled();
    });
  });
});
