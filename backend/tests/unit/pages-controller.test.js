jest.mock('../../server/utilities/storage', () => ({
  albumDir: jest.fn(),
  photoPath: jest.fn((ownerId, albumId, filename) => `/uploads/${ownerId}/${albumId}/${filename}`),
  photoUrl: jest.fn((ownerId, albumId, filename) => `/uploads/${ownerId}/${albumId}/${filename}`),
  ensureAlbumDir: jest.fn(),
  removeAlbumDir: jest.fn(),
}));

jest.mock('fs', () => ({
  rm: jest.fn((filePath, opts, cb) => cb(null)),
}));

const mongoose = require('mongoose');
const Album = require('../../server/data/Album');
const Page = require('../../server/data/Page');
const Reaction = require('../../server/data/Reaction');
const Circle = require('../../server/data/Circle');
const Notification = require('../../server/data/Notification');
const fs = require('fs');
const controller = require('../../server/controllers/pages-controller');

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

const ZERO_REACTION_COUNTS = { like: 0, love: 0, haha: 0, wow: 0, sad: 0, angry: 0 };

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
  visibility: 'private',
  owner: { toString: () => OWNER_ID },
  pageCount: 0,
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

const fakePage = (overrides = {}) => ({
  _id: PAGE_ID,
  album: ALBUM_ID,
  filename: 'abc.jpg',
  mimeType: 'image/jpeg',
  size: 1024,
  caption: '',
  toJSON: function () {
    const { toJSON: _drop, deleteOne: _drop2, save: _drop3, ...rest } = this;
    return rest;
  },
  deleteOne: jest.fn().mockResolvedValue({}),
  save: jest.fn().mockImplementation(function () {
    return Promise.resolve(this);
  }),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  // A photo upload to a shared album now fires a fire-and-forget
  // notification; stubbed globally so tests that don't care about it can't
  // accidentally hit the real Mongoose model.
  jest.spyOn(Notification, 'create').mockResolvedValue({ _id: 'notif1' });
  jest.spyOn(Notification, 'pruneExcessForRecipient').mockResolvedValue(null);
  // list() now always resolves a reaction summary per page; stubbed to "no
  // reactions" by default so tests that don't care about reactions can't
  // accidentally hit the real Mongoose model.
  jest.spyOn(Reaction, 'aggregate').mockResolvedValue([]);
  jest.spyOn(Reaction, 'find').mockResolvedValue([]);
  jest.spyOn(Reaction, 'deleteMany').mockResolvedValue({});
});

describe('pages-controller', () => {
  describe('requireOwnedAlbum', () => {
    test('404 for a malformed id (no DB hit)', () => {
      const findById = jest.spyOn(Album, 'findById');
      const res = mockRes();
      controller.requireOwnedAlbum({ params: { id: 'not-an-objectid' }, user: owner }, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(404);
      expect(findById).not.toHaveBeenCalled();
    });

    test('404 when the album does not exist', async () => {
      jest.spyOn(Album, 'findById').mockResolvedValue(null);
      const res = mockRes();
      controller.requireOwnedAlbum({ params: { id: ALBUM_ID }, user: owner }, res, jest.fn());
      await flush();
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('403 when a non-owner, non-admin requests it', async () => {
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      const res = mockRes();
      controller.requireOwnedAlbum({ params: { id: ALBUM_ID }, user: stranger }, res, jest.fn());
      await flush();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('sets req.album and calls next for the owner', async () => {
      const album = fakeAlbum();
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      const next = jest.fn();
      const req = { params: { id: ALBUM_ID }, user: owner };
      controller.requireOwnedAlbum(req, mockRes(), next);
      await flush();
      expect(req.album).toBe(album);
      expect(next).toHaveBeenCalled();
    });

    test('an Admin passes through too', async () => {
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      const next = jest.fn();
      controller.requireOwnedAlbum({ params: { id: ALBUM_ID }, user: admin }, mockRes(), next);
      await flush();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('requireReadableAlbum', () => {
    test('404 for a malformed id (no DB hit)', () => {
      const findById = jest.spyOn(Album, 'findById');
      const res = mockRes();
      controller.requireReadableAlbum(
        { params: { id: 'not-an-objectid' }, user: owner },
        res,
        jest.fn()
      );
      expect(res.status).toHaveBeenCalledWith(404);
      expect(findById).not.toHaveBeenCalled();
    });

    test('404 when the album does not exist', async () => {
      jest.spyOn(Album, 'findById').mockResolvedValue(null);
      const res = mockRes();
      controller.requireReadableAlbum({ params: { id: ALBUM_ID }, user: owner }, res, jest.fn());
      await flush();
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('403 when a stranger requests a private album', async () => {
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      const res = mockRes();
      controller.requireReadableAlbum(
        { params: { id: ALBUM_ID }, user: stranger },
        res,
        jest.fn()
      );
      await flush();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('sets req.album and calls next for a stranger on a public album', async () => {
      const album = fakeAlbum({ visibility: 'public' });
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      const next = jest.fn();
      const req = { params: { id: ALBUM_ID }, user: stranger };
      controller.requireReadableAlbum(req, mockRes(), next);
      await flush();
      expect(req.album).toBe(album);
      expect(next).toHaveBeenCalled();
    });

    test('sets req.album and calls next for the owner', async () => {
      const album = fakeAlbum();
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      const next = jest.fn();
      const req = { params: { id: ALBUM_ID }, user: owner };
      controller.requireReadableAlbum(req, mockRes(), next);
      await flush();
      expect(req.album).toBe(album);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('list', () => {
    test('404 for a malformed id', () => {
      const findById = jest.spyOn(Album, 'findById');
      const res = mockRes();
      controller.list({ params: { id: 'nope' }, user: owner }, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(findById).not.toHaveBeenCalled();
    });

    test('403 when a stranger requests a private album', async () => {
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      const res = mockRes();
      controller.list({ params: { id: ALBUM_ID }, user: stranger }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('owner sees their private album pages with a url and reaction summary per page', async () => {
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      const sort = jest.fn().mockResolvedValue([fakePage()]);
      jest.spyOn(Page, 'find').mockReturnValue({ sort });
      const res = mockRes();
      controller.list({ params: { id: ALBUM_ID }, user: owner }, res);
      await flush();
      expect(res.json).toHaveBeenCalledWith({
        pages: [
          expect.objectContaining({
            url: `/uploads/${OWNER_ID}/${ALBUM_ID}/abc.jpg`,
            reactions: { counts: ZERO_REACTION_COUNTS, total: 0, viewerReaction: null },
          }),
        ],
      });
    });

    test('includes reaction counts and the viewer\'s own reaction', async () => {
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      const sort = jest.fn().mockResolvedValue([fakePage()]);
      jest.spyOn(Page, 'find').mockReturnValue({ sort });
      jest.spyOn(Reaction, 'aggregate').mockResolvedValue([
        { _id: { page: PAGE_ID, type: 'love' }, count: 3 },
        { _id: { page: PAGE_ID, type: 'like' }, count: 1 },
      ]);
      jest
        .spyOn(Reaction, 'find')
        .mockResolvedValue([{ page: { toString: () => PAGE_ID }, type: 'love' }]);
      const res = mockRes();
      controller.list({ params: { id: ALBUM_ID }, user: owner }, res);
      await flush();
      expect(res.json).toHaveBeenCalledWith({
        pages: [
          expect.objectContaining({
            reactions: {
              counts: { ...ZERO_REACTION_COUNTS, love: 3, like: 1 },
              total: 4,
              viewerReaction: 'love',
            },
          }),
        ],
      });
    });

    test('a stranger can list a public album\'s pages', async () => {
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum({ visibility: 'public' }));
      jest.spyOn(Page, 'find').mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });
      const res = mockRes();
      controller.list({ params: { id: ALBUM_ID }, user: stranger }, res);
      await flush();
      expect(res.json).toHaveBeenCalledWith({ pages: [] });
    });

    test('500 when the query fails', async () => {
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      jest.spyOn(Page, 'find').mockReturnValue({ sort: () => Promise.reject(new Error('x')) });
      const res = mockRes();
      controller.list({ params: { id: ALBUM_ID }, user: owner }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('upload', () => {
    test('400 when no files are attached', async () => {
      const res = mockRes();
      controller.upload({ album: fakeAlbum(), files: [] }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('400 and cleans up the just-written files when the album cap would be exceeded', async () => {
      const album = fakeAlbum();
      jest.spyOn(Page, 'countDocuments').mockResolvedValue(299);
      const insertMany = jest.spyOn(Page, 'insertMany');
      const res = mockRes();
      const files = [
        { filename: 'a.jpg', mimetype: 'image/jpeg', size: 10 },
        { filename: 'b.jpg', mimetype: 'image/jpeg', size: 10 },
      ];
      controller.upload({ album, files }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(insertMany).not.toHaveBeenCalled();
      expect(fs.rm).toHaveBeenCalledTimes(2);
    });

    test('201 with the created pages, their urls, and the recomputed pageCount', async () => {
      const album = fakeAlbum();
      jest.spyOn(Page, 'countDocuments')
        .mockResolvedValueOnce(0) // cap check
        .mockResolvedValueOnce(1); // syncPageCount
      jest.spyOn(Page, 'insertMany').mockResolvedValue([fakePage()]);
      const res = mockRes();
      const files = [{ filename: 'abc.jpg', mimetype: 'image/jpeg', size: 1024 }];
      controller.upload({ album, files, user: owner }, res);
      await flush();
      expect(album.save).toHaveBeenCalled();
      expect(album.pageCount).toBe(1);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        pages: [
          expect.objectContaining({
            url: `/uploads/${OWNER_ID}/${ALBUM_ID}/abc.jpg`,
            reactions: { counts: ZERO_REACTION_COUNTS, total: 0, viewerReaction: null },
          }),
        ],
        pageCount: 1,
      });
    });

    test('cleans up written files and responds 500 when the DB write fails', async () => {
      const album = fakeAlbum();
      jest.spyOn(Page, 'countDocuments').mockResolvedValue(0);
      jest.spyOn(Page, 'insertMany').mockRejectedValue(new Error('db down'));
      const res = mockRes();
      const files = [{ filename: 'abc.jpg', mimetype: 'image/jpeg', size: 1024 }];
      controller.upload({ album, files }, res);
      await flush();
      expect(fs.rm).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(500);
    });

    test('maps a concurrent album-deletion DocumentNotFoundError to 404, not a generic 500', async () => {
      const album = fakeAlbum({
        save: jest.fn().mockRejectedValue(new mongoose.Error.DocumentNotFoundError({})),
      });
      jest.spyOn(Page, 'countDocuments').mockResolvedValueOnce(0).mockResolvedValueOnce(1);
      jest.spyOn(Page, 'insertMany').mockResolvedValue([fakePage()]);
      const res = mockRes();
      const files = [{ filename: 'abc.jpg', mimetype: 'image/jpeg', size: 1024 }];
      controller.upload({ album, files }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Album not found' });
    });

    test('notifies each accepted circle member when photos are added to a shared album', async () => {
      const album = fakeAlbum({ visibility: 'shared', sharedWithCircle: SHARED_CIRCLE_ID });
      jest.spyOn(Circle, 'findById').mockResolvedValue(fakeCircle());
      jest.spyOn(Page, 'countDocuments').mockResolvedValueOnce(0).mockResolvedValueOnce(1);
      jest.spyOn(Page, 'insertMany').mockResolvedValue([fakePage()]);
      const res = mockRes();
      const files = [{ filename: 'abc.jpg', mimetype: 'image/jpeg', size: 1024 }];
      controller.upload({ album, files, user: owner }, res);
      await flush();
      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient: MEMBER_ID,
          type: 'album_photos_added',
          album: ALBUM_ID,
          albumTitle: 'Summer',
        })
      );
      expect(Notification.create).not.toHaveBeenCalledWith(
        expect.objectContaining({ recipient: PENDING_MEMBER_ID })
      );
    });

    test('fires one notification per upload request, not one per photo', async () => {
      const album = fakeAlbum({ visibility: 'shared', sharedWithCircle: SHARED_CIRCLE_ID });
      jest.spyOn(Circle, 'findById').mockResolvedValue(fakeCircle());
      jest.spyOn(Page, 'countDocuments').mockResolvedValueOnce(0).mockResolvedValueOnce(3);
      jest
        .spyOn(Page, 'insertMany')
        .mockResolvedValue([fakePage(), fakePage({ _id: 'p2' }), fakePage({ _id: 'p3' })]);
      const res = mockRes();
      const files = [
        { filename: 'a.jpg', mimetype: 'image/jpeg', size: 10 },
        { filename: 'b.jpg', mimetype: 'image/jpeg', size: 10 },
        { filename: 'c.jpg', mimetype: 'image/jpeg', size: 10 },
      ];
      controller.upload({ album, files, user: owner }, res);
      await flush();
      const photosAddedCalls = Notification.create.mock.calls.filter(
        ([doc]) => doc.type === 'album_photos_added' && doc.recipient === MEMBER_ID
      );
      expect(photosAddedCalls).toHaveLength(1);
    });

    test('the single album_photos_added notification references the first uploaded page', async () => {
      const album = fakeAlbum({ visibility: 'shared', sharedWithCircle: SHARED_CIRCLE_ID });
      jest.spyOn(Circle, 'findById').mockResolvedValue(fakeCircle());
      jest.spyOn(Page, 'countDocuments').mockResolvedValueOnce(0).mockResolvedValueOnce(3);
      jest
        .spyOn(Page, 'insertMany')
        .mockResolvedValue([fakePage(), fakePage({ _id: 'p2' }), fakePage({ _id: 'p3' })]);
      const res = mockRes();
      const files = [
        { filename: 'a.jpg', mimetype: 'image/jpeg', size: 10 },
        { filename: 'b.jpg', mimetype: 'image/jpeg', size: 10 },
        { filename: 'c.jpg', mimetype: 'image/jpeg', size: 10 },
      ];
      controller.upload({ album, files, user: owner }, res);
      await flush();
      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'album_photos_added',
          recipient: MEMBER_ID,
          page: PAGE_ID,
        })
      );
    });

    test('does not notify when uploading to a private album', async () => {
      const album = fakeAlbum();
      const findById = jest.spyOn(Circle, 'findById');
      jest.spyOn(Page, 'countDocuments').mockResolvedValueOnce(0).mockResolvedValueOnce(1);
      jest.spyOn(Page, 'insertMany').mockResolvedValue([fakePage()]);
      const res = mockRes();
      const files = [{ filename: 'abc.jpg', mimetype: 'image/jpeg', size: 1024 }];
      controller.upload({ album, files, user: owner }, res);
      await flush();
      expect(findById).not.toHaveBeenCalled();
      expect(Notification.create).not.toHaveBeenCalled();
    });

    test('still responds 201 when creating the album_photos_added notification fails', async () => {
      const album = fakeAlbum({ visibility: 'shared', sharedWithCircle: SHARED_CIRCLE_ID });
      jest.spyOn(Circle, 'findById').mockResolvedValue(fakeCircle());
      jest.spyOn(Page, 'countDocuments').mockResolvedValueOnce(0).mockResolvedValueOnce(1);
      jest.spyOn(Page, 'insertMany').mockResolvedValue([fakePage()]);
      Notification.create.mockRejectedValue(new Error('db down'));
      const res = mockRes();
      const files = [{ filename: 'abc.jpg', mimetype: 'image/jpeg', size: 1024 }];
      controller.upload({ album, files, user: owner }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('updateCaption', () => {
    test('404 for a malformed page id', () => {
      const findOne = jest.spyOn(Page, 'findOne');
      const res = mockRes();
      controller.updateCaption(
        { album: fakeAlbum(), params: { pageId: 'nope' }, body: { caption: 'x' } },
        res
      );
      expect(res.status).toHaveBeenCalledWith(404);
      expect(findOne).not.toHaveBeenCalled();
    });

    test('404 when the page does not belong to this album', async () => {
      jest.spyOn(Page, 'findOne').mockResolvedValue(null);
      const res = mockRes();
      controller.updateCaption(
        { album: fakeAlbum(), params: { pageId: PAGE_ID }, body: { caption: 'x' } },
        res
      );
      await flush();
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('400 when caption is not a string', () => {
      const findOne = jest.spyOn(Page, 'findOne');
      const res = mockRes();
      controller.updateCaption(
        { album: fakeAlbum(), params: { pageId: PAGE_ID }, body: { caption: 42 } },
        res
      );
      expect(res.status).toHaveBeenCalledWith(400);
      expect(findOne).not.toHaveBeenCalled();
    });

    test('400 when caption is over 500 characters', () => {
      const findOne = jest.spyOn(Page, 'findOne');
      const res = mockRes();
      controller.updateCaption(
        { album: fakeAlbum(), params: { pageId: PAGE_ID }, body: { caption: 'x'.repeat(501) } },
        res
      );
      expect(res.status).toHaveBeenCalledWith(400);
      expect(findOne).not.toHaveBeenCalled();
    });

    test('sets the caption and returns the page with its url', async () => {
      const page = fakePage();
      jest.spyOn(Page, 'findOne').mockResolvedValue(page);
      const res = mockRes();
      controller.updateCaption(
        {
          album: fakeAlbum(),
          params: { pageId: PAGE_ID },
          body: { caption: 'A day at the lake' },
          user: owner,
        },
        res
      );
      await flush();
      expect(page.caption).toBe('A day at the lake');
      expect(page.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        page: expect.objectContaining({
          caption: 'A day at the lake',
          url: `/uploads/${OWNER_ID}/${ALBUM_ID}/abc.jpg`,
          reactions: { counts: ZERO_REACTION_COUNTS, total: 0, viewerReaction: null },
        }),
      });
    });

    test('an absent caption clears it to an empty string', async () => {
      const page = fakePage({ caption: 'old story' });
      jest.spyOn(Page, 'findOne').mockResolvedValue(page);
      const res = mockRes();
      controller.updateCaption({ album: fakeAlbum(), params: { pageId: PAGE_ID }, body: {} }, res);
      await flush();
      expect(page.caption).toBe('');
    });

    test('500 when the lookup fails', async () => {
      jest.spyOn(Page, 'findOne').mockRejectedValue(new Error('db down'));
      const res = mockRes();
      controller.updateCaption(
        { album: fakeAlbum(), params: { pageId: PAGE_ID }, body: { caption: 'x' } },
        res
      );
      await flush();
      expect(res.status).toHaveBeenCalledWith(500);
    });

    test('notifies each accepted circle member when a photo caption changes on a shared album', async () => {
      const album = fakeAlbum({ visibility: 'shared', sharedWithCircle: SHARED_CIRCLE_ID });
      const page = fakePage({ caption: 'old caption' });
      jest.spyOn(Circle, 'findById').mockResolvedValue(fakeCircle());
      jest.spyOn(Page, 'findOne').mockResolvedValue(page);
      const res = mockRes();
      controller.updateCaption(
        { album, params: { pageId: PAGE_ID }, body: { caption: 'new caption' }, user: owner },
        res
      );
      await flush();
      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient: MEMBER_ID,
          type: 'album_photo_caption_updated',
          album: ALBUM_ID,
          albumTitle: 'Summer',
        })
      );
      expect(Notification.create).not.toHaveBeenCalledWith(
        expect.objectContaining({ recipient: PENDING_MEMBER_ID })
      );
    });

    test('does not notify when the submitted caption is unchanged', async () => {
      const album = fakeAlbum({ visibility: 'shared', sharedWithCircle: SHARED_CIRCLE_ID });
      const page = fakePage({ caption: 'same caption' });
      const findById = jest.spyOn(Circle, 'findById');
      jest.spyOn(Page, 'findOne').mockResolvedValue(page);
      const res = mockRes();
      controller.updateCaption(
        { album, params: { pageId: PAGE_ID }, body: { caption: 'same caption' }, user: owner },
        res
      );
      await flush();
      expect(findById).not.toHaveBeenCalled();
      expect(Notification.create).not.toHaveBeenCalled();
    });

    test('does not notify for a whitespace-only edit — Page.caption is trimmed on save, so the stored value never actually changes', async () => {
      const album = fakeAlbum({ visibility: 'shared', sharedWithCircle: SHARED_CIRCLE_ID });
      const page = fakePage({ caption: 'same caption' });
      const findById = jest.spyOn(Circle, 'findById');
      jest.spyOn(Page, 'findOne').mockResolvedValue(page);
      const res = mockRes();
      controller.updateCaption(
        { album, params: { pageId: PAGE_ID }, body: { caption: '  same caption  ' }, user: owner },
        res
      );
      await flush();
      expect(findById).not.toHaveBeenCalled();
      expect(Notification.create).not.toHaveBeenCalled();
    });

    test('does not notify when the caption is omitted and was already empty — clearing an already-empty caption is a no-op', async () => {
      const album = fakeAlbum({ visibility: 'shared', sharedWithCircle: SHARED_CIRCLE_ID });
      const page = fakePage({ caption: '' });
      const findById = jest.spyOn(Circle, 'findById');
      jest.spyOn(Page, 'findOne').mockResolvedValue(page);
      const res = mockRes();
      controller.updateCaption({ album, params: { pageId: PAGE_ID }, body: {}, user: owner }, res);
      await flush();
      expect(findById).not.toHaveBeenCalled();
      expect(Notification.create).not.toHaveBeenCalled();
    });

    test('does not notify when captioning a photo in a private album', async () => {
      const album = fakeAlbum();
      const findById = jest.spyOn(Circle, 'findById');
      const page = fakePage({ caption: 'old' });
      jest.spyOn(Page, 'findOne').mockResolvedValue(page);
      const res = mockRes();
      controller.updateCaption(
        { album, params: { pageId: PAGE_ID }, body: { caption: 'new' }, user: owner },
        res
      );
      await flush();
      expect(findById).not.toHaveBeenCalled();
      expect(Notification.create).not.toHaveBeenCalled();
    });

    test('still responds 200 when creating the caption-updated notification fails', async () => {
      const album = fakeAlbum({ visibility: 'shared', sharedWithCircle: SHARED_CIRCLE_ID });
      const page = fakePage({ caption: 'old caption' });
      jest.spyOn(Circle, 'findById').mockResolvedValue(fakeCircle());
      jest.spyOn(Page, 'findOne').mockResolvedValue(page);
      Notification.create.mockRejectedValue(new Error('db down'));
      const res = mockRes();
      controller.updateCaption(
        { album, params: { pageId: PAGE_ID }, body: { caption: 'new caption' }, user: owner },
        res
      );
      await flush();
      expect(res.status).not.toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ page: expect.objectContaining({ caption: 'new caption' }) })
      );
    });
  });

  describe('remove', () => {
    test('404 for a malformed page id', () => {
      const findOne = jest.spyOn(Page, 'findOne');
      const res = mockRes();
      controller.remove({ album: fakeAlbum(), params: { pageId: 'nope' } }, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(findOne).not.toHaveBeenCalled();
    });

    test('404 when the page does not belong to this album', async () => {
      jest.spyOn(Page, 'findOne').mockResolvedValue(null);
      const res = mockRes();
      controller.remove({ album: fakeAlbum(), params: { pageId: PAGE_ID } }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('deletes the file, the record, its reactions, recomputes pageCount, and responds', async () => {
      const album = fakeAlbum();
      const page = fakePage();
      jest.spyOn(Page, 'findOne').mockResolvedValue(page);
      jest.spyOn(Page, 'countDocuments').mockResolvedValue(0);
      const res = mockRes();
      controller.remove({ album, params: { pageId: PAGE_ID } }, res);
      await flush();
      expect(fs.rm).toHaveBeenCalledWith(
        `/uploads/${OWNER_ID}/${ALBUM_ID}/abc.jpg`,
        { force: true },
        expect.any(Function)
      );
      expect(page.deleteOne).toHaveBeenCalled();
      expect(Reaction.deleteMany).toHaveBeenCalledWith({ page: PAGE_ID });
      expect(album.pageCount).toBe(0);
      expect(res.json).toHaveBeenCalledWith({ deleted: true, pageCount: 0 });
    });

    test('clears the album cover when the deleted photo was the cover', async () => {
      const album = fakeAlbum({ coverPage: PAGE_ID });
      const page = fakePage();
      jest.spyOn(Page, 'findOne').mockResolvedValue(page);
      jest.spyOn(Page, 'countDocuments').mockResolvedValue(0);
      const res = mockRes();
      controller.remove({ album, params: { pageId: PAGE_ID } }, res);
      await flush();
      expect(album.coverPage).toBeNull();
    });

    test('leaves the cover alone when a different photo is deleted', async () => {
      const album = fakeAlbum({ coverPage: 'some-other-page-id' });
      const page = fakePage();
      jest.spyOn(Page, 'findOne').mockResolvedValue(page);
      jest.spyOn(Page, 'countDocuments').mockResolvedValue(0);
      const res = mockRes();
      controller.remove({ album, params: { pageId: PAGE_ID } }, res);
      await flush();
      expect(album.coverPage).toBe('some-other-page-id');
    });

    test('500 when the lookup fails', async () => {
      jest.spyOn(Page, 'findOne').mockRejectedValue(new Error('db down'));
      const res = mockRes();
      controller.remove({ album: fakeAlbum(), params: { pageId: PAGE_ID } }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(500);
    });

    test('maps a concurrent album-deletion DocumentNotFoundError to 404, not a generic 500', async () => {
      const album = fakeAlbum({
        save: jest.fn().mockRejectedValue(new mongoose.Error.DocumentNotFoundError({})),
      });
      jest.spyOn(Page, 'findOne').mockResolvedValue(fakePage());
      jest.spyOn(Page, 'countDocuments').mockResolvedValue(0);
      const res = mockRes();
      controller.remove({ album, params: { pageId: PAGE_ID } }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Album not found' });
    });

    test('notifies each accepted circle member when a photo is removed from a shared album', async () => {
      const album = fakeAlbum({ visibility: 'shared', sharedWithCircle: SHARED_CIRCLE_ID });
      jest.spyOn(Circle, 'findById').mockResolvedValue(fakeCircle());
      jest.spyOn(Page, 'findOne').mockResolvedValue(fakePage());
      jest.spyOn(Page, 'countDocuments').mockResolvedValue(0);
      const res = mockRes();
      controller.remove({ album, params: { pageId: PAGE_ID }, user: owner }, res);
      await flush();
      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient: MEMBER_ID,
          type: 'album_photo_removed',
          album: ALBUM_ID,
          albumTitle: 'Summer',
        })
      );
      expect(Notification.create).not.toHaveBeenCalledWith(
        expect.objectContaining({ recipient: PENDING_MEMBER_ID })
      );
    });

    test('does not notify when removing a photo from a private album', async () => {
      const album = fakeAlbum();
      const findById = jest.spyOn(Circle, 'findById');
      jest.spyOn(Page, 'findOne').mockResolvedValue(fakePage());
      jest.spyOn(Page, 'countDocuments').mockResolvedValue(0);
      const res = mockRes();
      controller.remove({ album, params: { pageId: PAGE_ID }, user: owner }, res);
      await flush();
      expect(findById).not.toHaveBeenCalled();
      expect(Notification.create).not.toHaveBeenCalled();
    });

    test('still responds 200 when creating the album_photo_removed notification fails', async () => {
      const album = fakeAlbum({ visibility: 'shared', sharedWithCircle: SHARED_CIRCLE_ID });
      jest.spyOn(Circle, 'findById').mockResolvedValue(fakeCircle());
      jest.spyOn(Page, 'findOne').mockResolvedValue(fakePage());
      jest.spyOn(Page, 'countDocuments').mockResolvedValue(0);
      Notification.create.mockRejectedValue(new Error('db down'));
      const res = mockRes();
      controller.remove({ album, params: { pageId: PAGE_ID }, user: owner }, res);
      await flush();
      expect(res.status).not.toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ deleted: true, pageCount: 0 });
    });
  });

  describe('setReaction', () => {
    test('404 for a malformed page id', () => {
      const findOne = jest.spyOn(Page, 'findOne');
      const res = mockRes();
      controller.setReaction(
        { album: fakeAlbum(), params: { pageId: 'nope' }, body: { type: 'like' }, user: owner },
        res
      );
      expect(res.status).toHaveBeenCalledWith(404);
      expect(findOne).not.toHaveBeenCalled();
    });

    test('400 for a type outside the enum', () => {
      const findOne = jest.spyOn(Page, 'findOne');
      const res = mockRes();
      controller.setReaction(
        { album: fakeAlbum(), params: { pageId: PAGE_ID }, body: { type: 'shrug' }, user: owner },
        res
      );
      expect(res.status).toHaveBeenCalledWith(400);
      expect(findOne).not.toHaveBeenCalled();
    });

    test('404 when the page does not belong to this album', async () => {
      jest.spyOn(Page, 'findOne').mockResolvedValue(null);
      const res = mockRes();
      controller.setReaction(
        { album: fakeAlbum(), params: { pageId: PAGE_ID }, body: { type: 'like' }, user: owner },
        res
      );
      await flush();
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('creates a new reaction, notifies the album owner, and returns the summary', async () => {
      const album = fakeAlbum();
      const page = fakePage();
      jest.spyOn(Page, 'findOne').mockResolvedValue(page);
      jest.spyOn(Reaction, 'findOne').mockResolvedValue(null);
      const create = jest.spyOn(Reaction, 'create').mockResolvedValue({});
      const res = mockRes();
      controller.setReaction(
        { album, params: { pageId: PAGE_ID }, body: { type: 'love' }, user: stranger },
        res
      );
      await flush();
      expect(create).toHaveBeenCalledWith({
        page: PAGE_ID,
        album: ALBUM_ID,
        user: OTHER_ID,
        type: 'love',
      });
      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient: OWNER_ID,
          type: 'page_reaction',
          reactionType: 'love',
          page: PAGE_ID,
        })
      );
      expect(res.json).toHaveBeenCalledWith({
        reactions: { counts: ZERO_REACTION_COUNTS, total: 0, viewerReaction: null },
      });
    });

    test('does not notify when the reactor is the album owner', async () => {
      const album = fakeAlbum();
      const page = fakePage();
      jest.spyOn(Page, 'findOne').mockResolvedValue(page);
      jest.spyOn(Reaction, 'findOne').mockResolvedValue(null);
      jest.spyOn(Reaction, 'create').mockResolvedValue({});
      const res = mockRes();
      controller.setReaction(
        { album, params: { pageId: PAGE_ID }, body: { type: 'like' }, user: owner },
        res
      );
      await flush();
      expect(Notification.create).not.toHaveBeenCalled();
    });

    test('switches an existing reaction to a different type without re-notifying', async () => {
      const album = fakeAlbum();
      const page = fakePage();
      const existing = {
        type: 'like',
        save: jest.fn().mockImplementation(function () {
          return Promise.resolve(this);
        }),
        deleteOne: jest.fn(),
      };
      jest.spyOn(Page, 'findOne').mockResolvedValue(page);
      jest.spyOn(Reaction, 'findOne').mockResolvedValue(existing);
      const res = mockRes();
      controller.setReaction(
        { album, params: { pageId: PAGE_ID }, body: { type: 'wow' }, user: stranger },
        res
      );
      await flush();
      expect(existing.type).toBe('wow');
      expect(existing.save).toHaveBeenCalled();
      expect(existing.deleteOne).not.toHaveBeenCalled();
      expect(Notification.create).not.toHaveBeenCalled();
    });

    test('falls through to creating a fresh reaction when a concurrent request deletes it out from under a switch, without notifying (it is still just a switch from this user\'s perspective)', async () => {
      const album = fakeAlbum();
      const page = fakePage();
      const existing = {
        type: 'like',
        save: jest.fn().mockRejectedValue(new mongoose.Error.DocumentNotFoundError({})),
        deleteOne: jest.fn(),
      };
      jest.spyOn(Page, 'findOne').mockResolvedValue(page);
      jest.spyOn(Reaction, 'findOne').mockResolvedValue(existing);
      const create = jest.spyOn(Reaction, 'create').mockResolvedValue({});
      const res = mockRes();
      controller.setReaction(
        { album, params: { pageId: PAGE_ID }, body: { type: 'wow' }, user: stranger },
        res
      );
      await flush();
      expect(create).toHaveBeenCalledWith({ page: PAGE_ID, album: ALBUM_ID, user: OTHER_ID, type: 'wow' });
      expect(Notification.create).not.toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        reactions: { counts: ZERO_REACTION_COUNTS, total: 0, viewerReaction: null },
      });
    });

    test('a non-DocumentNotFoundError from an existing-reaction save still responds 500', async () => {
      const album = fakeAlbum();
      const page = fakePage();
      const existing = { type: 'like', save: jest.fn().mockRejectedValue(new Error('db down')) };
      jest.spyOn(Page, 'findOne').mockResolvedValue(page);
      jest.spyOn(Reaction, 'findOne').mockResolvedValue(existing);
      const res = mockRes();
      controller.setReaction(
        { album, params: { pageId: PAGE_ID }, body: { type: 'wow' }, user: stranger },
        res
      );
      await flush();
      expect(res.status).toHaveBeenCalledWith(500);
    });

    test('picking the same reaction again removes it (toggle-off)', async () => {
      const album = fakeAlbum();
      const page = fakePage();
      const existing = { type: 'like', save: jest.fn(), deleteOne: jest.fn().mockResolvedValue({}) };
      jest.spyOn(Page, 'findOne').mockResolvedValue(page);
      jest.spyOn(Reaction, 'findOne').mockResolvedValue(existing);
      const res = mockRes();
      controller.setReaction(
        { album, params: { pageId: PAGE_ID }, body: { type: 'like' }, user: stranger },
        res
      );
      await flush();
      expect(existing.deleteOne).toHaveBeenCalled();
      expect(existing.save).not.toHaveBeenCalled();
    });

    test('a concurrent duplicate-key error on create is a no-op when the winner already stored the same type', async () => {
      const album = fakeAlbum();
      const page = fakePage();
      jest.spyOn(Page, 'findOne').mockResolvedValue(page);
      const duplicateKeyError = Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
      jest.spyOn(Reaction, 'create').mockRejectedValue(duplicateKeyError);
      const winnerSave = jest.fn();
      jest
        .spyOn(Reaction, 'findOne')
        .mockResolvedValueOnce(null) // this request's own initial check
        .mockResolvedValueOnce({ type: 'like', save: winnerSave }); // post-race reconciliation read
      const res = mockRes();
      controller.setReaction(
        { album, params: { pageId: PAGE_ID }, body: { type: 'like' }, user: stranger },
        res
      );
      await flush();
      expect(res.status).not.toHaveBeenCalledWith(500);
      expect(winnerSave).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        reactions: { counts: ZERO_REACTION_COUNTS, total: 0, viewerReaction: null },
      });
    });

    test('a concurrent duplicate-key error on create reconciles to this request\'s type when the winner stored a different one', async () => {
      const album = fakeAlbum();
      const page = fakePage();
      jest.spyOn(Page, 'findOne').mockResolvedValue(page);
      const duplicateKeyError = Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
      jest.spyOn(Reaction, 'create').mockRejectedValue(duplicateKeyError);
      const winner = {
        type: 'like',
        save: jest.fn().mockImplementation(function () {
          return Promise.resolve(this);
        }),
      };
      jest
        .spyOn(Reaction, 'findOne')
        .mockResolvedValueOnce(null) // this request's own initial check
        .mockResolvedValueOnce(winner); // post-race reconciliation read
      const res = mockRes();
      controller.setReaction(
        { album, params: { pageId: PAGE_ID }, body: { type: 'love' }, user: stranger },
        res
      );
      await flush();
      expect(winner.type).toBe('love');
      expect(winner.save).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalledWith(500);
    });

    test('500 for a non-duplicate-key error', async () => {
      const album = fakeAlbum();
      const page = fakePage();
      jest.spyOn(Page, 'findOne').mockResolvedValue(page);
      jest.spyOn(Reaction, 'findOne').mockResolvedValue(null);
      jest.spyOn(Reaction, 'create').mockRejectedValue(new Error('db down'));
      const res = mockRes();
      controller.setReaction(
        { album, params: { pageId: PAGE_ID }, body: { type: 'like' }, user: stranger },
        res
      );
      await flush();
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('setCover', () => {
    test('404 for a malformed page id', () => {
      const findOne = jest.spyOn(Page, 'findOne');
      const res = mockRes();
      controller.setCover({ album: fakeAlbum(), params: { pageId: 'nope' } }, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(findOne).not.toHaveBeenCalled();
    });

    test('404 when the page does not belong to this album', async () => {
      jest.spyOn(Page, 'findOne').mockResolvedValue(null);
      const res = mockRes();
      controller.setCover({ album: fakeAlbum(), params: { pageId: PAGE_ID } }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('sets the cover and returns the updated album with its url', async () => {
      const album = fakeAlbum();
      const page = fakePage();
      jest.spyOn(Page, 'findOne').mockResolvedValue(page);
      const res = mockRes();
      controller.setCover({ album, params: { pageId: PAGE_ID } }, res);
      await flush();
      expect(album.coverPage).toBe(PAGE_ID);
      expect(album.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        album: expect.objectContaining({
          coverPage: PAGE_ID,
          coverImage: `/uploads/${OWNER_ID}/${ALBUM_ID}/abc.jpg`,
        }),
      });
    });

    test('500 when the lookup fails', async () => {
      jest.spyOn(Page, 'findOne').mockRejectedValue(new Error('db down'));
      const res = mockRes();
      controller.setCover({ album: fakeAlbum(), params: { pageId: PAGE_ID } }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(500);
    });

    test('maps a concurrent album-deletion DocumentNotFoundError to 404, not a generic 500', async () => {
      const album = fakeAlbum({
        save: jest.fn().mockRejectedValue(new mongoose.Error.DocumentNotFoundError({})),
      });
      jest.spyOn(Page, 'findOne').mockResolvedValue(fakePage());
      const res = mockRes();
      controller.setCover({ album, params: { pageId: PAGE_ID } }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Album not found' });
    });
  });
});
