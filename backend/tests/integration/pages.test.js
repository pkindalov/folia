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
  let auth;
  let token;
  let strangerToken;

  beforeAll(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'folia-uploads-'));
    process.env.UPLOADS_DIR = tmpRoot;

    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    User = require('../../server/data/User');
    Album = require('../../server/data/Album');
    Page = require('../../server/data/Page');
    auth = require('../../server/config/auth');

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

  const fakeAlbum = (overrides = {}) => ({
    _id: ALBUM_ID,
    visibility: 'private',
    owner: OWNER_ID,
    pageCount: 0,
    save: jest.fn().mockResolvedValue(undefined),
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
        expect(page.url).toMatch(new RegExp(`^/uploads/${OWNER_ID}/${ALBUM_ID}/.+\\.(jpg|png)$`));
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
      expect(res.body.pages[0].url).toBe(`/uploads/${OWNER_ID}/${ALBUM_ID}/a.jpg`);
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
      expect(res.body.page.url).toBe(`/uploads/${OWNER_ID}/${ALBUM_ID}/a.jpg`);
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

      const res = await request(app)
        .delete(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ deleted: true, pageCount: 0 });
    });
  });
});
