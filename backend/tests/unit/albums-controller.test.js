jest.mock('../../server/utilities/storage', () => ({
  albumDir: jest.fn(),
  ensureAlbumDir: jest.fn(),
  removeAlbumDir: jest.fn(),
}));

const Album = require('../../server/data/Album');
const Page = require('../../server/data/Page');
const storage = require('../../server/utilities/storage');
const controller = require('../../server/controllers/albums-controller');

const flush = () => new Promise(setImmediate);

const OWNER_ID = '507f1f77bcf86cd799439011';
const OTHER_ID = '507f1f77bcf86cd799439022';
const ALBUM_ID = '507f191e810c19729de860ea';

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
  save: jest.fn().mockImplementation(function () {
    return Promise.resolve(this);
  }),
  deleteOne: jest.fn().mockResolvedValue({}),
  ...overrides,
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

    test('responds 201 with the album', async () => {
      const album = fakeAlbum();
      jest.spyOn(Album, 'create').mockResolvedValue(album);
      const res = mockRes();
      controller.create({ body: { title: 'Summer' }, user: owner }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ album });
    });
  });

  describe('list', () => {
    test('returns only the albums owned by the requester', async () => {
      const sort = jest.fn().mockResolvedValue([fakeAlbum()]);
      const find = jest.spyOn(Album, 'find').mockReturnValue({ sort });
      const res = mockRes();
      controller.list({ user: owner }, res);
      await flush();
      expect(find).toHaveBeenCalledWith({ owner: OWNER_ID });
      expect(res.json).toHaveBeenCalledWith({ albums: [expect.any(Object)] });
    });

    test('returns 500 when the query fails', async () => {
      jest.spyOn(Album, 'find').mockReturnValue({ sort: () => Promise.reject(new Error('x')) });
      const res = mockRes();
      controller.list({ user: owner }, res);
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
      expect(res.json).toHaveBeenCalledWith({ album });
    });

    test('a stranger can read a public album', async () => {
      const album = fakeAlbum({ visibility: 'public' });
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      const res = mockRes();
      controller.getOne({ params: { id: ALBUM_ID }, user: stranger }, res);
      await flush();
      expect(res.json).toHaveBeenCalledWith({ album });
    });

    test('an Admin can read any private album', async () => {
      const album = fakeAlbum();
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      const res = mockRes();
      controller.getOne({ params: { id: ALBUM_ID }, user: admin }, res);
      await flush();
      expect(res.json).toHaveBeenCalledWith({ album });
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
      expect(res.json).toHaveBeenCalledWith({ album });
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
