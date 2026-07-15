jest.mock('../../server/utilities/storage', () => ({
  albumDir: jest.fn(),
  ensureAlbumDir: jest.fn(),
  removeAlbumDir: jest.fn(),
  photoUrl: jest.fn((ownerId, albumId, filename) => `/uploads/${ownerId}/${albumId}/${filename}`),
}));

const mongoose = require('mongoose');
const Album = require('../../server/data/Album');
const Page = require('../../server/data/Page');
const Reaction = require('../../server/data/Reaction');
const AlbumReaction = require('../../server/data/AlbumReaction');
const Comment = require('../../server/data/Comment');
const User = require('../../server/data/User');
const Circle = require('../../server/data/Circle');
const Notification = require('../../server/data/Notification');
const storage = require('../../server/utilities/storage');
const controller = require('../../server/controllers/albums-controller');

const flush = () => new Promise(setImmediate);

const OWNER_ID = '507f1f77bcf86cd799439011';
const OTHER_ID = '507f1f77bcf86cd799439022';
const MEMBER_ID = '507f1f77bcf86cd799439033';
const PENDING_MEMBER_ID = '507f1f77bcf86cd799439055';
const ALBUM_ID = '507f191e810c19729de860ea';
const PAGE_ID = '507f191e810c19729de860eb';
const SHARED_CIRCLE_ID = '507f1f77bcf86cd799439099';

const owner = { _id: OWNER_ID, username: 'pan', roles: ['User'] };
const stranger = { _id: OTHER_ID, username: 'maria', roles: ['User'] };
const admin = { _id: OTHER_ID, username: 'root', roles: ['Admin'] };

// A circle owned by `owner`, with one accepted member (who should be
// notified about album events) and one still-pending invitee (who
// shouldn't — they never had real access). Used wherever an album is shared
// with a circle and the notification's recipients matter, not just
// verifySharedCircleOwnership's pass/fail check.
const fakeCircle = (overrides = {}) => ({
  _id: SHARED_CIRCLE_ID,
  name: 'The Sterling Family',
  owner: { toString: () => OWNER_ID },
  members: [
    { user: MEMBER_ID, status: 'accepted' },
    { user: PENDING_MEMBER_ID, status: 'pending' },
  ],
  ...overrides,
});

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
  toJSON: function () {
    const { toJSON: _drop, save: _drop2, ...rest } = this;
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

// AlbumReaction.find(...) is called two ways depending on the caller:
// unchained (resolveAlbumReactionSummaries, the batched list variant) and
// chained with .sort().limit() (resolveAlbumReactionSummary, the single
// getOne/setReaction variant). A thenable with sort/limit no-ops that
// return itself satisfies both call shapes with one mock.
const mockReactorQuery = (docs) => {
  const query = Promise.resolve(docs);
  query.sort = () => query;
  query.limit = () => query;
  return query;
};

beforeEach(() => {
  mockNoPages();
  // Default: the referenced circle still exists, so healDanglingCircleReference
  // is a no-op unless a test deliberately overrides this to exercise the
  // self-heal path.
  jest.spyOn(Circle, 'exists').mockResolvedValue(true);
  // Every mutation on a shared album now fires a fire-and-forget
  // notification; stubbed globally (rather than per-test) so a test that
  // doesn't care about notifications can't accidentally hit the real
  // Mongoose model, mirroring circles-controller.test.js's convention.
  jest.spyOn(Notification, 'create').mockResolvedValue({ _id: 'notif1' });
  jest.spyOn(Notification, 'pruneExcessForRecipient').mockResolvedValue(null);
  jest.spyOn(Reaction, 'deleteMany').mockResolvedValue({});
  // getOne/list now always resolve an album love-reaction summary; stubbed
  // to "no reactions" by default so tests that don't care about it can't
  // accidentally hit the real Mongoose model, mirroring the Reaction mocks
  // above and pages-controller.test.js's convention for page reactions.
  jest.spyOn(AlbumReaction, 'countDocuments').mockResolvedValue(0);
  jest.spyOn(AlbumReaction, 'exists').mockResolvedValue(null);
  jest.spyOn(AlbumReaction, 'aggregate').mockResolvedValue([]);
  jest.spyOn(AlbumReaction, 'find').mockImplementation(() => mockReactorQuery([]));
  jest.spyOn(AlbumReaction, 'deleteMany').mockResolvedValue({});
  jest.spyOn(Comment, 'deleteMany').mockResolvedValue({});
  // setReaction re-verifies the album still exists before writing; default
  // to "still there" so tests that don't care about the concurrent-delete
  // race can't accidentally hit the real Mongoose model.
  jest.spyOn(Album, 'exists').mockResolvedValue(true);
});

const ZERO_ALBUM_REACTIONS = { total: 0, viewerReacted: false };
// getOne and setReaction resolve the single-album summary (which also
// includes who reacted); list resolves the batched one (which doesn't,
// since no UI currently renders it there) — see album-reactions.js.
const ZERO_ALBUM_REACTIONS_WITH_REACTORS = { ...ZERO_ALBUM_REACTIONS, reactors: [] };

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
      expect(res.json).toHaveBeenCalledWith({
        album: { ...album.toJSON(), coverImage: null },
      });
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

    test('self-heals a circle deleted between the ownership check and the save', async () => {
      // The circle existed when verifySharedCircleOwnership checked it, but a
      // concurrent circle delete finished before this album's own document
      // was persisted — the album must not keep pointing at it.
      jest.spyOn(Circle, 'findById').mockResolvedValue({ owner: { toString: () => OWNER_ID } });
      jest.spyOn(Circle, 'exists').mockResolvedValue(false);
      const album = fakeAlbum({
        visibility: 'shared',
        sharedWithCircle: '507f1f77bcf86cd799439099',
      });
      jest.spyOn(Album, 'create').mockResolvedValue(album);
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
      expect(album.sharedWithCircle).toBeNull();
      expect(album.visibility).toBe('private');
      expect(album.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    });

    test('reflects an already-reverted album instead of trusting a stale in-memory copy, when a concurrent circle deletion unshared it before its own document was removed', async () => {
      // A circle deletion unshares every album pointing at it (a query-based
      // updateMany) *before* deleting the circle document itself. If that
      // updateMany runs in the gap between this album's own save() and its
      // Circle.exists check, Circle.exists still sees the circle as existing
      // (its document hasn't been removed yet) even though this exact album
      // was already reverted to private in the database. Trusting the
      // in-memory `album` object here would incorrectly report "shared".
      jest.spyOn(Circle, 'findById').mockResolvedValue({ owner: { toString: () => OWNER_ID } });
      jest.spyOn(Circle, 'exists').mockResolvedValue(true);
      const album = fakeAlbum({
        visibility: 'shared',
        sharedWithCircle: '507f1f77bcf86cd799439099',
      });
      jest.spyOn(Album, 'create').mockResolvedValue(album);
      const alreadyRevertedAlbum = fakeAlbum({ visibility: 'private', sharedWithCircle: null });
      jest.spyOn(Album, 'findById').mockResolvedValue(alreadyRevertedAlbum);
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
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          album: expect.objectContaining({ visibility: 'private', sharedWithCircle: null }),
        })
      );
      expect(Notification.create).not.toHaveBeenCalled();
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

    test('creating an album directly as shared notifies the accepted circle members, not the pending invitee', async () => {
      jest.spyOn(Circle, 'findById').mockResolvedValue(fakeCircle());
      const createdAlbum = fakeAlbum({
        visibility: 'shared',
        sharedWithCircle: SHARED_CIRCLE_ID,
        title: 'Summer Trip',
      });
      jest.spyOn(Album, 'create').mockResolvedValue(createdAlbum);
      // healDanglingCircleReference re-reads the album once it confirms the
      // circle still exists, to guard against a concurrent circle deletion
      // having already unshared it in the gap since save() — here it's just
      // the same, still-shared album.
      jest.spyOn(Album, 'findById').mockResolvedValue(createdAlbum);
      const res = mockRes();
      controller.create(
        {
          body: { title: 'Summer Trip', visibility: 'shared', sharedWithCircle: SHARED_CIRCLE_ID },
          user: owner,
        },
        res
      );
      await flush();
      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient: MEMBER_ID,
          type: 'album_shared',
          circle: SHARED_CIRCLE_ID,
          circleName: 'The Sterling Family',
          actorUsername: 'pan',
          album: ALBUM_ID,
          albumTitle: 'Summer Trip',
        })
      );
      expect(Notification.create).not.toHaveBeenCalledWith(
        expect.objectContaining({ recipient: PENDING_MEMBER_ID })
      );
      // The circle owner and the album's creator are the same person here —
      // no point notifying yourself of your own action.
      expect(Notification.create).not.toHaveBeenCalledWith(
        expect.objectContaining({ recipient: OWNER_ID })
      );
    });

    test('does not notify anyone when creating a private album', async () => {
      const findById = jest.spyOn(Circle, 'findById');
      jest.spyOn(Album, 'create').mockResolvedValue(fakeAlbum());
      const res = mockRes();
      controller.create({ body: { title: 'Summer' }, user: owner }, res);
      await flush();
      expect(findById).not.toHaveBeenCalled();
      expect(Notification.create).not.toHaveBeenCalled();
    });

    test('still responds 201 when creating the album_shared notification fails', async () => {
      jest.spyOn(Circle, 'findById').mockResolvedValue(fakeCircle());
      const createdAlbum = fakeAlbum({ visibility: 'shared', sharedWithCircle: SHARED_CIRCLE_ID });
      jest.spyOn(Album, 'create').mockResolvedValue(createdAlbum);
      jest.spyOn(Album, 'findById').mockResolvedValue(createdAlbum);
      Notification.create.mockRejectedValue(new Error('db down'));
      const res = mockRes();
      controller.create(
        { body: { title: 'Summer', visibility: 'shared', sharedWithCircle: SHARED_CIRCLE_ID }, user: owner },
        res
      );
      await flush();
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
        albums: [{ ...album.toJSON(), coverImage: null, reactions: ZERO_ALBUM_REACTIONS }],
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
            {
              ...album.toJSON(),
              coverImage: `/uploads/${OWNER_ID}/${ALBUM_ID}/first.jpg`,
              reactions: ZERO_ALBUM_REACTIONS,
            },
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
            {
              ...album.toJSON(),
              coverImage: `/uploads/${OWNER_ID}/${ALBUM_ID}/chosen.jpg`,
              reactions: ZERO_ALBUM_REACTIONS,
            },
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
            {
              ...album.toJSON(),
              coverImage: `/uploads/${OWNER_ID}/${ALBUM_ID}/first.jpg`,
              reactions: ZERO_ALBUM_REACTIONS,
            },
          ],
        })
      );
    });

    test('reflects a non-zero love count and this viewer having loved the album', async () => {
      const album = fakeAlbum();
      jest.spyOn(Album, 'find').mockReturnValue(mockAlbumQuery([album]));
      jest.spyOn(Album, 'countDocuments').mockResolvedValue(1);
      jest.spyOn(AlbumReaction, 'aggregate').mockResolvedValue([{ _id: ALBUM_ID, count: 3 }]);
      jest.spyOn(AlbumReaction, 'find').mockResolvedValue([{ album: ALBUM_ID }]);
      const res = mockRes();
      controller.list({ user: owner, query: {} }, res);
      await flush();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          albums: [
            expect.objectContaining({ reactions: { total: 3, viewerReacted: true } }),
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
      expect(res.json).toHaveBeenCalledWith({
        album: { ...album.toJSON(), coverImage: null, reactions: ZERO_ALBUM_REACTIONS_WITH_REACTORS },
      });
    });

    test('a stranger can read a public album', async () => {
      const album = fakeAlbum({ visibility: 'public' });
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      const res = mockRes();
      controller.getOne({ params: { id: ALBUM_ID }, user: stranger }, res);
      await flush();
      expect(res.json).toHaveBeenCalledWith({
        album: { ...album.toJSON(), coverImage: null, reactions: ZERO_ALBUM_REACTIONS_WITH_REACTORS },
      });
    });

    test('an Admin can read any private album', async () => {
      const album = fakeAlbum();
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      const res = mockRes();
      controller.getOne({ params: { id: ALBUM_ID }, user: admin }, res);
      await flush();
      expect(res.json).toHaveBeenCalledWith({
        album: { ...album.toJSON(), coverImage: null, reactions: ZERO_ALBUM_REACTIONS_WITH_REACTORS },
      });
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
      expect(res.json).toHaveBeenCalledWith({
        album: { ...album.toJSON(), coverImage: null, reactions: ZERO_ALBUM_REACTIONS_WITH_REACTORS },
      });
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

    test('maps a concurrent-deletion DocumentNotFoundError to 404, not a generic 400', async () => {
      const album = fakeAlbum({
        save: jest.fn().mockRejectedValue(new mongoose.Error.DocumentNotFoundError({})),
      });
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      const res = mockRes();
      controller.update({ params: { id: ALBUM_ID }, body: { title: 'New' }, user: owner }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Album not found' });
    });

    test('maps a 404, not a generic 400, when the album is deleted in the narrow window between its own save() and healDanglingCircleReference re-reading it', async () => {
      // Same race healDanglingCircleReference already guards against for a
      // reverted-to-private album, but here the album itself vanished, not
      // just its circle link. Circle.exists still sees the circle (its own
      // deletion hasn't reached that document yet), so this hits the
      // re-read branch — where the re-read must now come back null.
      const album = fakeAlbum({
        visibility: 'shared',
        sharedWithCircle: SHARED_CIRCLE_ID,
      });
      jest.spyOn(Circle, 'exists').mockResolvedValue(true);
      jest
        .spyOn(Album, 'findById')
        .mockResolvedValueOnce(album) // the initial load in update()
        .mockResolvedValueOnce(null); // healDanglingCircleReference's re-read
      const res = mockRes();
      controller.update(
        { params: { id: ALBUM_ID }, body: { title: 'New' }, user: owner },
        res
      );
      await flush();
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Album not found' });
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
      expect(res.json).toHaveBeenCalledWith({
        album: { ...album.toJSON(), coverImage: null },
      });
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
      jest.spyOn(Circle, 'findById').mockResolvedValue(fakeCircle());
      const res = mockRes();
      controller.update(
        { params: { id: ALBUM_ID }, body: { sharedWithCircle: SHARED_CIRCLE_ID }, user: owner },
        res
      );
      await flush();
      expect(album.sharedWithCircle).toBe(SHARED_CIRCLE_ID);
      expect(album.save).toHaveBeenCalled();
    });

    test('newly sharing a previously-private album notifies the circle (album_shared)', async () => {
      const album = fakeAlbum({ visibility: 'private', sharedWithCircle: null });
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      jest.spyOn(Circle, 'findById').mockResolvedValue(fakeCircle());
      const res = mockRes();
      controller.update(
        {
          params: { id: ALBUM_ID },
          body: { visibility: 'shared', sharedWithCircle: SHARED_CIRCLE_ID },
          user: owner,
        },
        res
      );
      await flush();
      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient: MEMBER_ID,
          type: 'album_shared',
          album: ALBUM_ID,
          albumTitle: 'Summer',
        })
      );
      expect(Notification.create).not.toHaveBeenCalledWith(
        expect.objectContaining({ recipient: PENDING_MEMBER_ID })
      );
    });

    test('re-sharing an already-shared album with a different circle notifies the new circle as album_shared', async () => {
      const album = fakeAlbum({ visibility: 'shared', sharedWithCircle: 'some-other-circle-id' });
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      jest.spyOn(Circle, 'findById').mockResolvedValue(fakeCircle());
      const res = mockRes();
      controller.update(
        { params: { id: ALBUM_ID }, body: { sharedWithCircle: SHARED_CIRCLE_ID }, user: owner },
        res
      );
      await flush();
      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({ recipient: MEMBER_ID, type: 'album_shared', circle: SHARED_CIRCLE_ID })
      );
    });

    test('editing the title of an already-shared album notifies the circle as album_updated, not album_shared', async () => {
      const album = fakeAlbum({
        visibility: 'shared',
        sharedWithCircle: SHARED_CIRCLE_ID,
        title: 'Old title',
      });
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      jest.spyOn(Circle, 'findById').mockResolvedValue(fakeCircle());
      const res = mockRes();
      controller.update(
        { params: { id: ALBUM_ID }, body: { title: 'New title' }, user: owner },
        res
      );
      await flush();
      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({ recipient: MEMBER_ID, type: 'album_updated', albumTitle: 'New title' })
      );
    });

    test('editing the description of an already-shared album notifies the circle as album_updated', async () => {
      const album = fakeAlbum({
        visibility: 'shared',
        sharedWithCircle: SHARED_CIRCLE_ID,
        description: 'Old description',
      });
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      jest.spyOn(Circle, 'findById').mockResolvedValue(fakeCircle());
      const res = mockRes();
      controller.update(
        { params: { id: ALBUM_ID }, body: { description: 'New description' }, user: owner },
        res
      );
      await flush();
      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({ recipient: MEMBER_ID, type: 'album_updated' })
      );
    });

    test('saving the same title/description again does not notify — nothing actually changed', async () => {
      const album = fakeAlbum({
        visibility: 'shared',
        sharedWithCircle: SHARED_CIRCLE_ID,
        title: 'Summer',
        description: 'Same',
      });
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      const findById = jest.spyOn(Circle, 'findById').mockResolvedValue(fakeCircle());
      const res = mockRes();
      controller.update(
        { params: { id: ALBUM_ID }, body: { title: 'Summer', description: 'Same' }, user: owner },
        res
      );
      await flush();
      expect(findById).not.toHaveBeenCalled();
      expect(Notification.create).not.toHaveBeenCalled();
    });

    test('toggling archived on a shared album does not notify — not content the circle sees differently', async () => {
      const album = fakeAlbum({ visibility: 'shared', sharedWithCircle: SHARED_CIRCLE_ID, archived: false });
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      const findById = jest.spyOn(Circle, 'findById').mockResolvedValue(fakeCircle());
      const res = mockRes();
      controller.update(
        { params: { id: ALBUM_ID }, body: { archived: true }, user: owner },
        res
      );
      await flush();
      expect(findById).not.toHaveBeenCalled();
      expect(Notification.create).not.toHaveBeenCalled();
    });

    test('unsharing an album (moving away from shared) does not notify — no "unshared" notification type exists', async () => {
      const album = fakeAlbum({ visibility: 'shared', sharedWithCircle: SHARED_CIRCLE_ID });
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      const res = mockRes();
      controller.update(
        { params: { id: ALBUM_ID }, body: { visibility: 'private' }, user: owner },
        res
      );
      await flush();
      expect(Notification.create).not.toHaveBeenCalled();
    });

    test('still responds 200 when creating the album_updated notification fails', async () => {
      const album = fakeAlbum({
        visibility: 'shared',
        sharedWithCircle: SHARED_CIRCLE_ID,
        title: 'Old title',
      });
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      jest.spyOn(Circle, 'findById').mockResolvedValue(fakeCircle());
      Notification.create.mockRejectedValue(new Error('db down'));
      const res = mockRes();
      controller.update(
        { params: { id: ALBUM_ID }, body: { title: 'New title' }, user: owner },
        res
      );
      await flush();
      expect(res.status).not.toHaveBeenCalledWith(500);
      expect(res.status).not.toHaveBeenCalledWith(400);
    });

    test('self-heals a circle deleted between the ownership check and the save', async () => {
      // Mirrors the same race on the update path: the circle passed
      // verifySharedCircleOwnership, but was deleted by a concurrent request
      // before this album's save() actually persisted the reference.
      const album = fakeAlbum({ visibility: 'shared' });
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      jest.spyOn(Circle, 'findById').mockResolvedValue({ owner: { toString: () => OWNER_ID } });
      jest.spyOn(Circle, 'exists').mockResolvedValue(false);
      const res = mockRes();
      controller.update(
        { params: { id: ALBUM_ID }, body: { sharedWithCircle: '507f1f77bcf86cd799439099' }, user: owner },
        res
      );
      await flush();
      expect(album.sharedWithCircle).toBeNull();
      expect(album.visibility).toBe('private');
      expect(res.status).not.toHaveBeenCalledWith(400);
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
      // Circle.findById *is* still called once, but only by the
      // album_updated notification lookup below, not by ownership
      // re-verification — the update succeeding (not a 400) is what proves
      // re-verification was skipped.
      const album = fakeAlbum({
        visibility: 'shared',
        sharedWithCircle: SHARED_CIRCLE_ID,
      });
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      jest.spyOn(Circle, 'findById').mockResolvedValue(fakeCircle());
      const res = mockRes();
      controller.update(
        { params: { id: ALBUM_ID }, body: { description: 'new description' }, user: admin },
        res
      );
      await flush();
      expect(album.description).toBe('new description');
      expect(album.sharedWithCircle).toBe(SHARED_CIRCLE_ID);
      expect(res.status).not.toHaveBeenCalledWith(400);
      expect(album.save).toHaveBeenCalled();
      // The Admin acted, not the album's real owner — so the owner (who
      // didn't perform this edit) is a recipient, unlike the Admin themselves.
      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({ recipient: OWNER_ID, type: 'album_updated', actorUsername: 'root' })
      );
      expect(Notification.create).not.toHaveBeenCalledWith(
        expect.objectContaining({ recipient: OTHER_ID })
      );
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

  describe('setReaction', () => {
    test('creates a love reaction, notifies the album owner, and returns the summary', async () => {
      const album = fakeAlbum();
      jest.spyOn(AlbumReaction, 'findOne').mockResolvedValue(null);
      const create = jest.spyOn(AlbumReaction, 'create').mockResolvedValue({});
      jest.spyOn(AlbumReaction, 'countDocuments').mockResolvedValue(1);
      jest.spyOn(AlbumReaction, 'exists').mockResolvedValue({ _id: 'r1' });
      const res = mockRes();
      controller.setReaction({ album, user: stranger }, res);
      await flush();
      expect(create).toHaveBeenCalledWith({ album: ALBUM_ID, user: OTHER_ID });
      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient: OWNER_ID,
          type: 'album_reaction',
          actorUsername: 'maria',
          actor: OTHER_ID,
          album: ALBUM_ID,
          albumTitle: 'Summer',
        })
      );
      expect(res.json).toHaveBeenCalledWith({
        reactions: { total: 1, viewerReacted: true, reactors: [] },
      });
    });

    test('does not notify when the reactor is the album owner', async () => {
      const album = fakeAlbum();
      jest.spyOn(AlbumReaction, 'findOne').mockResolvedValue(null);
      jest.spyOn(AlbumReaction, 'create').mockResolvedValue({});
      const res = mockRes();
      controller.setReaction({ album, user: owner }, res);
      await flush();
      expect(Notification.create).not.toHaveBeenCalled();
    });

    test('toggles an existing reaction off (removes it, does not notify)', async () => {
      const existing = { deleteOne: jest.fn().mockResolvedValue({}) };
      const album = fakeAlbum();
      jest.spyOn(AlbumReaction, 'findOne').mockResolvedValue(existing);
      const create = jest.spyOn(AlbumReaction, 'create');
      const res = mockRes();
      controller.setReaction({ album, user: stranger }, res);
      await flush();
      expect(existing.deleteOne).toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
      expect(Notification.create).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ reactions: ZERO_ALBUM_REACTIONS_WITH_REACTORS });
    });

    test('a concurrent duplicate-key error on create is swallowed — no 500, no double notification', async () => {
      const album = fakeAlbum();
      jest.spyOn(AlbumReaction, 'findOne').mockResolvedValue(null);
      const duplicateKeyError = Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
      jest.spyOn(AlbumReaction, 'create').mockRejectedValue(duplicateKeyError);
      const res = mockRes();
      controller.setReaction({ album, user: stranger }, res);
      await flush();
      expect(res.status).not.toHaveBeenCalledWith(500);
      expect(Notification.create).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ reactions: ZERO_ALBUM_REACTIONS_WITH_REACTORS });
    });

    test('500 for a non-duplicate-key error', async () => {
      const album = fakeAlbum();
      jest.spyOn(AlbumReaction, 'findOne').mockResolvedValue(null);
      jest.spyOn(AlbumReaction, 'create').mockRejectedValue(new Error('db down'));
      const res = mockRes();
      controller.setReaction({ album, user: stranger }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(500);
    });

    // req.album is a snapshot from requireReadableAlbum's earlier load — a
    // concurrent DELETE /api/albums/:id (which cascades AlbumReaction rows
    // away too) could remove it before this handler runs. Without the
    // re-check, this would silently write a permanently orphaned
    // AlbumReaction row and notify the (former) owner about a love on an
    // album that no longer exists.
    test('404s and does not write when the album was deleted by a concurrent request', async () => {
      const album = fakeAlbum();
      jest.spyOn(Album, 'exists').mockResolvedValue(null);
      const findOne = jest.spyOn(AlbumReaction, 'findOne');
      const create = jest.spyOn(AlbumReaction, 'create');
      const res = mockRes();
      controller.setReaction({ album, user: stranger }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(404);
      expect(findOne).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
      expect(Notification.create).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    test('403 when a non-owner tries to delete', async () => {
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      const findOneAndDelete = jest.spyOn(Album, 'findOneAndDelete');
      const res = mockRes();
      controller.remove({ params: { id: ALBUM_ID }, user: stranger }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(findOneAndDelete).not.toHaveBeenCalled();
      expect(storage.removeAlbumDir).not.toHaveBeenCalled();
    });

    test('500 and leaves the album/pages untouched when removing the upload folder fails', async () => {
      const album = fakeAlbum();
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      const findOneAndDelete = jest.spyOn(Album, 'findOneAndDelete');
      const deleteMany = jest.spyOn(Page, 'deleteMany');
      storage.removeAlbumDir.mockImplementationOnce(() => {
        throw new Error('EBUSY: resource busy or locked');
      });
      const res = mockRes();
      controller.remove({ params: { id: ALBUM_ID }, user: owner }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to delete album' });
      // Nothing in the DB was touched — a failed disk removal must leave
      // the album fully intact so the delete is safely retryable, instead
      // of deleting the DB rows first and risking an unrecoverable orphan.
      expect(findOneAndDelete).not.toHaveBeenCalled();
      expect(deleteMany).not.toHaveBeenCalled();
    });

    test('deletes the album, its pages, and its upload folder', async () => {
      const album = fakeAlbum();
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      const findOneAndDelete = jest.spyOn(Album, 'findOneAndDelete').mockResolvedValue(album);
      const deleteMany = jest.spyOn(Page, 'deleteMany').mockResolvedValue({});
      const res = mockRes();
      controller.remove({ params: { id: ALBUM_ID }, user: owner }, res);
      await flush();
      expect(findOneAndDelete).toHaveBeenCalledWith({ _id: ALBUM_ID });
      expect(deleteMany).toHaveBeenCalledWith({ album: ALBUM_ID });
      expect(storage.removeAlbumDir).toHaveBeenCalledWith(album.owner, ALBUM_ID);
      expect(res.json).toHaveBeenCalledWith({ deleted: true });
    });

    test('deletes the album\'s reactions along with its pages', async () => {
      const album = fakeAlbum();
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      jest.spyOn(Album, 'findOneAndDelete').mockResolvedValue(album);
      jest.spyOn(Page, 'deleteMany').mockResolvedValue({});
      const res = mockRes();
      controller.remove({ params: { id: ALBUM_ID }, user: owner }, res);
      await flush();
      expect(Reaction.deleteMany).toHaveBeenCalledWith({ album: ALBUM_ID });
      expect(res.json).toHaveBeenCalledWith({ deleted: true });
    });

    test('deletes the album\'s love reactions along with its pages', async () => {
      const album = fakeAlbum();
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      jest.spyOn(Album, 'findOneAndDelete').mockResolvedValue(album);
      jest.spyOn(Page, 'deleteMany').mockResolvedValue({});
      const res = mockRes();
      controller.remove({ params: { id: ALBUM_ID }, user: owner }, res);
      await flush();
      expect(AlbumReaction.deleteMany).toHaveBeenCalledWith({ album: ALBUM_ID });
      expect(res.json).toHaveBeenCalledWith({ deleted: true });
    });

    test('an Admin can delete any album', async () => {
      const album = fakeAlbum();
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      const findOneAndDelete = jest.spyOn(Album, 'findOneAndDelete').mockResolvedValue(album);
      jest.spyOn(Page, 'deleteMany').mockResolvedValue({});
      const res = mockRes();
      controller.remove({ params: { id: ALBUM_ID }, user: admin }, res);
      await flush();
      expect(findOneAndDelete).toHaveBeenCalled();
    });

    test('404 for malformed id, no deletion attempted', () => {
      const findById = jest.spyOn(Album, 'findById');
      const res = mockRes();
      controller.remove({ params: { id: '../../etc' }, user: owner }, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(findById).not.toHaveBeenCalled();
    });

    // The atomic findOneAndDelete only ever actually removes the document
    // once — a second concurrent delete request for the same album finds
    // nothing left to remove and gets null back. It should still report
    // success but must not re-run page cleanup or notifications the winning
    // request already did.
    test('a losing race against a concurrent delete of the same album still reports success, but skips cleanup/notifications', async () => {
      jest.spyOn(Album, 'findById').mockResolvedValue(
        fakeAlbum({ visibility: 'shared', sharedWithCircle: SHARED_CIRCLE_ID })
      );
      jest.spyOn(Album, 'findOneAndDelete').mockResolvedValue(null);
      const deleteMany = jest.spyOn(Page, 'deleteMany');
      const res = mockRes();
      controller.remove({ params: { id: ALBUM_ID }, user: owner }, res);
      await flush();
      expect(res.status).not.toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ deleted: true });
      expect(deleteMany).not.toHaveBeenCalled();
      // removeAlbumDir runs before the atomic findOneAndDelete, so the
      // loser still calls it too — harmless, since it's a no-op force-remove
      // of a folder the winner may have already deleted.
      expect(storage.removeAlbumDir).toHaveBeenCalled();
      expect(Notification.create).not.toHaveBeenCalled();
    });

    test('notifies each accepted circle member when a shared album is deleted', async () => {
      const album = fakeAlbum({
        visibility: 'shared',
        sharedWithCircle: SHARED_CIRCLE_ID,
        title: 'Summer Trip',
      });
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      jest.spyOn(Album, 'findOneAndDelete').mockResolvedValue(album);
      jest.spyOn(Circle, 'findById').mockResolvedValue(fakeCircle());
      jest.spyOn(Page, 'deleteMany').mockResolvedValue({});
      const res = mockRes();
      controller.remove({ params: { id: ALBUM_ID }, user: owner }, res);
      await flush();
      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient: MEMBER_ID,
          type: 'album_deleted',
          albumTitle: 'Summer Trip',
        })
      );
      expect(Notification.create).not.toHaveBeenCalledWith(
        expect.objectContaining({ recipient: PENDING_MEMBER_ID })
      );
    });

    test('does not notify anyone when deleting a private album', async () => {
      const album = fakeAlbum();
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      jest.spyOn(Album, 'findOneAndDelete').mockResolvedValue(album);
      const findById = jest.spyOn(Circle, 'findById');
      jest.spyOn(Page, 'deleteMany').mockResolvedValue({});
      const res = mockRes();
      controller.remove({ params: { id: ALBUM_ID }, user: owner }, res);
      await flush();
      expect(findById).not.toHaveBeenCalled();
      expect(Notification.create).not.toHaveBeenCalled();
    });

    test('still responds with deleted:true when creating the deletion notification fails', async () => {
      const album = fakeAlbum({ visibility: 'shared', sharedWithCircle: SHARED_CIRCLE_ID });
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      jest.spyOn(Album, 'findOneAndDelete').mockResolvedValue(album);
      jest.spyOn(Circle, 'findById').mockResolvedValue(fakeCircle());
      jest.spyOn(Page, 'deleteMany').mockResolvedValue({});
      Notification.create.mockRejectedValue(new Error('db down'));
      const res = mockRes();
      controller.remove({ params: { id: ALBUM_ID }, user: owner }, res);
      await flush();
      expect(res.status).not.toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ deleted: true });
    });
  });
});
