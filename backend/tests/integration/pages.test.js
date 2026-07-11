const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const OWNER_ID = '507f1f77bcf86cd799439011';
const OTHER_ID = '507f1f77bcf86cd799439022';
const ALBUM_ID = '507f191e810c19729de860ea';
const PAGE_ID = '507f191e810c19729de860eb';

describe('album pages routes (integration)', () => {
  let app;
  let tmpRoot;
  let User;
  let Album;
  let Page;
  let Circle;
  let Reaction;
  let Notification;
  let auth;
  let signedUrl;
  let token;
  let strangerToken;

  // Photo URLs now carry a signature (see storage.photoUrl / signed-url.js),
  // so a plain string-equality check against the old unsigned shape no
  // longer applies — assert the path is right and the signature verifies.
  function expectSignedUploadUrl(url, expectedPathname) {
    const parsed = new URL(url, 'http://localhost');
    expect(parsed.pathname).toBe(expectedPathname);
    expect(
      signedUrl.verify(parsed.pathname, parsed.searchParams.get('exp'), parsed.searchParams.get('sig'))
    ).toBe(true);
  }

  beforeAll(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'folia-uploads-'));
    process.env.UPLOADS_DIR = tmpRoot;

    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    // Required only now, after UPLOADS_DIR is set — settings.js reads env
    // vars once at first require and caches the result, so requiring any
    // of these earlier would freeze uploadsDir at its default instead of
    // this test's tmp directory.
    User = require('../../server/data/User');
    Album = require('../../server/data/Album');
    Page = require('../../server/data/Page');
    Circle = require('../../server/data/Circle');
    Reaction = require('../../server/data/Reaction');
    Notification = require('../../server/data/Notification');
    auth = require('../../server/config/auth');
    signedUrl = require('../../server/utilities/signed-url');

    const express = require('express');
    app = express();
    require('../../server/config/express')(app);
    require('../../server/config/routes')(app);

    token = auth.signToken({ _id: OWNER_ID, username: 'pan' });
    strangerToken = auth.signToken({ _id: OTHER_ID, username: 'maria' });
  });

  afterAll(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    delete process.env.UPLOADS_DIR;
  });

  // GET .../pages now always resolves a reaction summary per page; stubbed
  // to "no reactions" by default so tests that don't care about reactions
  // can't accidentally hit the real Mongoose model.
  beforeEach(() => {
    jest.spyOn(Reaction, 'aggregate').mockResolvedValue([]);
    jest.spyOn(Reaction, 'find').mockResolvedValue([]);
  });

  const fakeAlbum = (overrides = {}) => ({
    _id: ALBUM_ID,
    visibility: 'private',
    owner: OWNER_ID,
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

  const authAs = (id, roles = ['User']) => {
    jest.spyOn(User, 'findById').mockResolvedValue({ _id: id, username: 'pan', roles });
  };

  describe('POST /api/albums/:id/pages', () => {
    test('401 without a token', async () => {
      const res = await request(app).post(`/api/albums/${ALBUM_ID}/pages`);
      expect(res.status).toBe(401);
    });

    test('404 when the album does not exist', async () => {
      authAs(OWNER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(null);
      const res = await request(app)
        .post(`/api/albums/${ALBUM_ID}/pages`)
        .set('Authorization', `Bearer ${token}`)
        .attach('photos', Buffer.from('fake'), 'a.jpg');
      expect(res.status).toBe(404);
    });

    test('403 when a stranger tries to upload to someone else\'s album', async () => {
      authAs(OTHER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      const res = await request(app)
        .post(`/api/albums/${ALBUM_ID}/pages`)
        .set('Authorization', `Bearer ${strangerToken}`)
        .attach('photos', Buffer.from('fake'), 'a.jpg');
      expect(res.status).toBe(403);
    });

    test('400 when no photos are attached', async () => {
      authAs(OWNER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      const res = await request(app)
        .post(`/api/albums/${ALBUM_ID}/pages`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
    });

    test('400 for an unsupported file type', async () => {
      authAs(OWNER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      const res = await request(app)
        .post(`/api/albums/${ALBUM_ID}/pages`)
        .set('Authorization', `Bearer ${token}`)
        .attach('photos', Buffer.from('not an image'), 'notes.txt');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/supported/i);
    });

    test('413 for a photo over the size limit', async () => {
      authAs(OWNER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      const oversized = Buffer.alloc(10 * 1024 * 1024 + 1);
      const res = await request(app)
        .post(`/api/albums/${ALBUM_ID}/pages`)
        .set('Authorization', `Bearer ${token}`)
        .attach('photos', oversized, 'huge.jpg');
      expect(res.status).toBe(413);
    });

    test('400 when a single request exceeds the per-upload file count', async () => {
      authAs(OWNER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      let req = request(app)
        .post(`/api/albums/${ALBUM_ID}/pages`)
        .set('Authorization', `Bearer ${token}`);
      for (let i = 0; i < 21; i++) {
        req = req.attach('photos', Buffer.from('fake'), `p${i}.jpg`);
      }
      const res = await req;
      expect(res.status).toBe(400);
    });

    test('201 saves the files to disk and returns page records with urls', async () => {
      authAs(OWNER_ID);
      const album = fakeAlbum();
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      jest.spyOn(Page, 'countDocuments').mockResolvedValue(0);
      jest.spyOn(Page, 'insertMany').mockImplementation((docs) =>
        Promise.resolve(
          docs.map((doc, i) => ({
            ...doc,
            _id: `fake-id-${i}`,
            toJSON() {
              const { toJSON: _drop, ...rest } = this;
              return rest;
            },
          }))
        )
      );

      const res = await request(app)
        .post(`/api/albums/${ALBUM_ID}/pages`)
        .set('Authorization', `Bearer ${token}`)
        .attach('photos', Buffer.from('fake-jpeg-bytes'), 'a.jpg')
        .attach('photos', Buffer.from('fake-png-bytes'), 'b.png');

      expect(res.status).toBe(201);
      expect(res.body.pages).toHaveLength(2);
      for (const page of res.body.pages) {
        expect(page.url).toMatch(
          new RegExp(`^/uploads/${OWNER_ID}/${ALBUM_ID}/.+\\.(jpg|png)\\?exp=\\d+&sig=[0-9a-f]+$`)
        );
      }

      const albumFolder = path.join(tmpRoot, OWNER_ID, ALBUM_ID);
      const writtenFiles = fs.readdirSync(albumFolder);
      expect(writtenFiles).toHaveLength(2);
    });
  });

  describe('GET /api/albums/:id/pages', () => {
    test('403 when a stranger requests a private album\'s pages', async () => {
      authAs(OTHER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      const res = await request(app)
        .get(`/api/albums/${ALBUM_ID}/pages`)
        .set('Authorization', `Bearer ${strangerToken}`);
      expect(res.status).toBe(403);
    });

    test('403 when a stranger requests a shared album restricted to a circle they are not in', async () => {
      authAs(OTHER_ID);
      const album = fakeAlbum({
        visibility: 'shared',
        sharedWithCircle: '507f1f77bcf86cd799439099',
      });
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      jest.spyOn(Circle, 'findById').mockResolvedValue(
        new Circle({ name: 'Family', owner: OWNER_ID, members: [] })
      );
      const res = await request(app)
        .get(`/api/albums/${ALBUM_ID}/pages`)
        .set('Authorization', `Bearer ${strangerToken}`);
      expect(res.status).toBe(403);
    });

    test('200 when a circle member requests a shared album restricted to their circle', async () => {
      authAs(OTHER_ID);
      const album = fakeAlbum({
        visibility: 'shared',
        sharedWithCircle: '507f1f77bcf86cd799439099',
      });
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      jest.spyOn(Circle, 'findById').mockResolvedValue(
        new Circle({
          name: 'Family',
          owner: OWNER_ID,
          members: [{ user: OTHER_ID, status: 'accepted' }],
        })
      );
      jest.spyOn(Page, 'find').mockReturnValue({
        sort: jest.fn().mockResolvedValue([]),
      });
      const res = await request(app)
        .get(`/api/albums/${ALBUM_ID}/pages`)
        .set('Authorization', `Bearer ${strangerToken}`);
      expect(res.status).toBe(200);
    });

    test('200 with the owner\'s pages', async () => {
      authAs(OWNER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      jest.spyOn(Page, 'find').mockReturnValue({
        sort: jest.fn().mockResolvedValue([
          {
            _id: PAGE_ID,
            filename: 'a.jpg',
            toJSON() {
              const { toJSON: _drop, ...rest } = this;
              return rest;
            },
          },
        ]),
      });
      const res = await request(app)
        .get(`/api/albums/${ALBUM_ID}/pages`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expectSignedUploadUrl(res.body.pages[0].url, `/uploads/${OWNER_ID}/${ALBUM_ID}/a.jpg`);
    });
  });

  describe('PUT /api/albums/:id/pages/:pageId', () => {
    test('403 when a stranger tries to set a caption', async () => {
      authAs(OTHER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      const res = await request(app)
        .put(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}`)
        .set('Authorization', `Bearer ${strangerToken}`)
        .send({ caption: 'A day at the lake' });
      expect(res.status).toBe(403);
    });

    test('404 when the photo does not belong to the album', async () => {
      authAs(OWNER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      jest.spyOn(Page, 'findOne').mockResolvedValue(null);
      const res = await request(app)
        .put(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ caption: 'A day at the lake' });
      expect(res.status).toBe(404);
    });

    test('400 for a caption over 500 characters', async () => {
      authAs(OWNER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      const res = await request(app)
        .put(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ caption: 'x'.repeat(501) });
      expect(res.status).toBe(400);
    });

    test('200 saves the caption and returns the updated page', async () => {
      authAs(OWNER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      jest.spyOn(Page, 'findOne').mockResolvedValue({
        _id: PAGE_ID,
        filename: 'a.jpg',
        caption: '',
        save: jest.fn().mockImplementation(function () {
          return Promise.resolve(this);
        }),
        toJSON() {
          const { toJSON: _drop, save: _drop2, ...rest } = this;
          return rest;
        },
      });

      const res = await request(app)
        .put(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ caption: 'A day at the lake' });

      expect(res.status).toBe(200);
      expect(res.body.page.caption).toBe('A day at the lake');
      expectSignedUploadUrl(res.body.page.url, `/uploads/${OWNER_ID}/${ALBUM_ID}/a.jpg`);
    });
  });

  describe('PUT /api/albums/:id/pages/:pageId/cover', () => {
    test('403 when a stranger tries to set the cover', async () => {
      authAs(OTHER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      const res = await request(app)
        .put(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/cover`)
        .set('Authorization', `Bearer ${strangerToken}`);
      expect(res.status).toBe(403);
    });

    test('404 when the photo does not belong to the album', async () => {
      authAs(OWNER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      jest.spyOn(Page, 'findOne').mockResolvedValue(null);
      const res = await request(app)
        .put(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/cover`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    test('200 sets the cover and returns the updated album with its url', async () => {
      authAs(OWNER_ID);
      const album = fakeAlbum();
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      jest.spyOn(Page, 'findOne').mockResolvedValue({ _id: PAGE_ID, filename: 'a.jpg' });

      const res = await request(app)
        .put(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/cover`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.album.coverPage).toBe(PAGE_ID);
      expectSignedUploadUrl(res.body.album.coverImage, `/uploads/${OWNER_ID}/${ALBUM_ID}/a.jpg`);
    });
  });

  describe('DELETE /api/albums/:id/pages/:pageId', () => {
    test('404 when the photo does not belong to the album', async () => {
      authAs(OWNER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      jest.spyOn(Page, 'findOne').mockResolvedValue(null);
      const res = await request(app)
        .delete(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    test('403 when a stranger tries to delete a photo', async () => {
      authAs(OTHER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      const res = await request(app)
        .delete(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}`)
        .set('Authorization', `Bearer ${strangerToken}`);
      expect(res.status).toBe(403);
    });

    test('200 deletes the photo and returns the recomputed pageCount', async () => {
      authAs(OWNER_ID);
      const album = fakeAlbum();
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      jest.spyOn(Page, 'findOne').mockResolvedValue({
        filename: 'a.jpg',
        deleteOne: jest.fn().mockResolvedValue(undefined),
      });
      jest.spyOn(Page, 'countDocuments').mockResolvedValue(0);
      jest.spyOn(Reaction, 'deleteMany').mockResolvedValue({});

      const res = await request(app)
        .delete(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ deleted: true, pageCount: 0 });
    });
  });

  describe('PUT /api/albums/:id/pages/:pageId/reaction', () => {
    beforeEach(() => {
      jest.spyOn(Notification, 'create').mockResolvedValue({ _id: 'notif1' });
      jest.spyOn(Notification, 'pruneExcessForRecipient').mockResolvedValue(null);
    });

    test('401 without a token', async () => {
      const res = await request(app).put(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/reaction`);
      expect(res.status).toBe(401);
    });

    test('403 when a stranger reacts to a private album', async () => {
      authAs(OTHER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      const res = await request(app)
        .put(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/reaction`)
        .set('Authorization', `Bearer ${strangerToken}`)
        .send({ type: 'like' });
      expect(res.status).toBe(403);
    });

    test('400 for a type outside the enum', async () => {
      authAs(OWNER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      const res = await request(app)
        .put(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/reaction`)
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'shrug' });
      expect(res.status).toBe(400);
    });

    test('404 when the photo does not belong to the album', async () => {
      authAs(OWNER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      jest.spyOn(Page, 'findOne').mockResolvedValue(null);
      const res = await request(app)
        .put(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/reaction`)
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'like' });
      expect(res.status).toBe(404);
    });

    test('a circle member can react to a shared album, and the owner is notified', async () => {
      authAs(OTHER_ID);
      const album = fakeAlbum({
        visibility: 'shared',
        sharedWithCircle: '507f1f77bcf86cd799439099',
      });
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      jest.spyOn(Circle, 'findById').mockResolvedValue(
        new Circle({
          name: 'Family',
          owner: OWNER_ID,
          members: [{ user: OTHER_ID, status: 'accepted' }],
        })
      );
      jest.spyOn(Page, 'findOne').mockResolvedValue({ _id: PAGE_ID, filename: 'a.jpg' });
      jest.spyOn(Reaction, 'findOne').mockResolvedValue(null);
      jest.spyOn(Reaction, 'create').mockResolvedValue({});

      const res = await request(app)
        .put(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/reaction`)
        .set('Authorization', `Bearer ${strangerToken}`)
        .send({ type: 'love' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        reactions: {
          counts: { like: 0, love: 0, haha: 0, wow: 0, sad: 0, angry: 0 },
          total: 0,
          viewerReaction: null,
          reactors: [],
        },
      });
      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({ recipient: OWNER_ID, type: 'page_reaction', reactionType: 'love' })
      );
    });

    test('picking the same reaction twice removes it', async () => {
      authAs(OWNER_ID);
      const album = fakeAlbum();
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      jest.spyOn(Page, 'findOne').mockResolvedValue({ _id: PAGE_ID, filename: 'a.jpg' });
      const deleteOne = jest.fn().mockResolvedValue({});
      jest.spyOn(Reaction, 'findOne').mockResolvedValue({ type: 'like', deleteOne });

      const res = await request(app)
        .put(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/reaction`)
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'like' });

      expect(res.status).toBe(200);
      expect(deleteOne).toHaveBeenCalled();
    });
  });

  describe('GET /uploads/:ownerId/:albumId/:filename (signature enforcement)', () => {
    const pathname = `/uploads/${OWNER_ID}/${ALBUM_ID}/signature-check.jpg`;

    beforeAll(() => {
      const dir = path.join(tmpRoot, OWNER_ID, ALBUM_ID);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'signature-check.jpg'), 'fake-jpeg-bytes');
    });

    test('serves the file when the signature is valid', async () => {
      const signedPath = signedUrl.sign(pathname);
      const res = await request(app).get(signedPath);
      expect(res.status).toBe(200);
      expect(Buffer.from(res.body).toString()).toBe('fake-jpeg-bytes');
    });

    test('rejects a request with no signature at all', async () => {
      const res = await request(app).get(pathname);
      expect(res.status).toBe(403);
    });

    test('rejects a signature minted for a different file', async () => {
      const signedForOtherFile = signedUrl.sign(`/uploads/${OWNER_ID}/${ALBUM_ID}/other.jpg`);
      const query = signedForOtherFile.slice(signedForOtherFile.indexOf('?'));
      const res = await request(app).get(`${pathname}${query}`);
      expect(res.status).toBe(403);
    });

    test('rejects an expired signature', async () => {
      const expiredPath = signedUrl.sign(pathname, -1000);
      const res = await request(app).get(expiredPath);
      expect(res.status).toBe(403);
    });
  });
});
