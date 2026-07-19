const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const OWNER_ID = '507f1f77bcf86cd799439011';
const OTHER_ID = '507f1f77bcf86cd799439022';
const REPLIER_ID = '507f1f77bcf86cd799439033';
const ALBUM_ID = '507f191e810c19729de860ea';
const PAGE_ID = '507f191e810c19729de860eb';
const COMMENT_ID = '507f191e810c19729de860ec';

describe('album pages routes (integration)', () => {
  let app;
  let tmpRoot;
  let User;
  let Album;
  let Page;
  let Circle;
  let Reaction;
  let Comment;
  let CommentReaction;
  let Notification;
  let auth;
  let signedUrl;
  let token;
  let strangerToken;
  let replierToken;

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
    Comment = require('../../server/data/Comment');
    CommentReaction = require('../../server/data/CommentReaction');
    Notification = require('../../server/data/Notification');
    auth = require('../../server/config/auth');
    signedUrl = require('../../server/utilities/signed-url');

    const express = require('express');
    app = express();
    require('../../server/config/express')(app);
    require('../../server/config/routes')(app);

    token = auth.signToken({ _id: OWNER_ID, username: 'pan' });
    strangerToken = auth.signToken({ _id: OTHER_ID, username: 'maria' });
    replierToken = auth.signToken({ _id: REPLIER_ID, username: 'sam' });
  });

  afterAll(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    delete process.env.UPLOADS_DIR;
  });

  // GET .../pages now always resolves a reaction summary per page; stubbed
  // to "no reactions" by default so tests that don't care about reactions
  // can't accidentally hit the real Mongoose model. Same reasoning for
  // Comment.find (deleteComment now looks up a deleted comment's replies
  // before cascading their reactions), Comment.exists (setCommentReaction's
  // post-write check that the comment wasn't concurrently deleted — see its
  // own tests below), and every CommentReaction query
  // (listComments/addComment/setCommentReaction/deleteComment all resolve or
  // cascade comment reaction summaries) — each defaults to "nothing there"
  // (or, for Comment.exists, "still there"), and any test that cares
  // overrides it explicitly.
  beforeEach(() => {
    jest.spyOn(Reaction, 'aggregate').mockResolvedValue([]);
    jest.spyOn(Reaction, 'find').mockResolvedValue([]);
    jest.spyOn(Comment, 'aggregate').mockResolvedValue([]);
    jest.spyOn(Comment, 'deleteMany').mockResolvedValue({});
    jest.spyOn(Comment, 'find').mockResolvedValue([]);
    jest.spyOn(Comment, 'exists').mockResolvedValue(true);
    jest.spyOn(CommentReaction, 'aggregate').mockResolvedValue([]);
    jest.spyOn(CommentReaction, 'find').mockResolvedValue([]);
    jest.spyOn(CommentReaction, 'deleteMany').mockResolvedValue({});
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
      jest.spyOn(Album, 'exists').mockResolvedValue(true);
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

  describe('GET /api/albums/:id/pages/:pageId/comments', () => {
    test('403 when a stranger requests comments on a private album\'s photo', async () => {
      authAs(OTHER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      const res = await request(app)
        .get(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/comments`)
        .set('Authorization', `Bearer ${strangerToken}`);
      expect(res.status).toBe(403);
    });

    test('404 when the photo does not belong to the album', async () => {
      authAs(OWNER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      jest.spyOn(Page, 'findOne').mockResolvedValue(null);
      const res = await request(app)
        .get(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/comments`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    // Comment.find(...).sort(...).limit(...) — a chained mock builder shared
    // by the pagination tests below, so each only has to specify what
    // Comment.find eventually resolves to (newest-first, as the controller
    // requests it). listComments also fetches each returned comment's first
    // page of replies via attachReplies, which groups by parent through
    // Comment.aggregate rather than a flat find() — `replies` here is a flat
    // list (each carrying its own parentComment) that this helper groups
    // into the same shape a real aggregation would return. Comment.hydrate
    // is mocked to a passthrough so these plain fixture objects (with their
    // own lightweight toJSON, see fakeComment) flow straight through instead
    // of attempting real Mongoose document construction.
    const fakeComment = (overrides) => ({
      page: PAGE_ID,
      user: OTHER_ID,
      toJSON() {
        const { toJSON: _drop, ...rest } = this;
        return rest;
      },
      ...overrides,
    });
    const mockCommentFind = (newestFirstComments, replies = []) => {
      jest.spyOn(Comment, 'find').mockReturnValue({
        sort: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue(newestFirstComments) }),
      });
      jest.spyOn(Comment, 'hydrate').mockImplementation((doc) => doc);
      const repliesByParentId = new Map();
      for (const reply of replies) {
        const parentId = reply.parentComment.toString();
        const existing = repliesByParentId.get(parentId) ?? [];
        existing.push(reply);
        repliesByParentId.set(parentId, existing);
      }
      jest.spyOn(Comment, 'aggregate').mockResolvedValue(
        [...repliesByParentId.entries()].map(([parentId, parentReplies]) => ({ _id: parentId, replies: parentReplies }))
      );
    };

    test('200 returns the comment thread with each author resolved', async () => {
      authAs(OWNER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      jest.spyOn(Page, 'findOne').mockResolvedValue({ _id: PAGE_ID, album: ALBUM_ID });
      mockCommentFind([fakeComment({ _id: COMMENT_ID, text: 'Lovely!' })]);
      jest.spyOn(User, 'find').mockResolvedValue([{ _id: OTHER_ID, username: 'maria', avatarFilename: null }]);

      const res = await request(app)
        .get(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/comments`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.comments).toEqual([
        expect.objectContaining({ _id: COMMENT_ID, text: 'Lovely!', username: 'maria', avatarUrl: null }),
      ]);
      expect(res.body.hasMore).toBe(false);
    });

    test('200 nests each top-level comment\'s replies, oldest-first, with their own authors resolved', async () => {
      authAs(OWNER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      jest.spyOn(Page, 'findOne').mockResolvedValue({ _id: PAGE_ID, album: ALBUM_ID });
      const REPLY = fakeComment({
        _id: 'reply1',
        text: 'Totally agree!',
        parentComment: COMMENT_ID,
        user: OWNER_ID,
      });
      mockCommentFind([fakeComment({ _id: COMMENT_ID, text: 'Lovely!' })], [REPLY]);
      jest.spyOn(User, 'find').mockResolvedValue([
        { _id: OTHER_ID, username: 'maria', avatarFilename: null },
        { _id: OWNER_ID, username: 'pan', avatarFilename: null },
      ]);

      const res = await request(app)
        .get(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/comments`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.comments[0].replies).toEqual([
        expect.objectContaining({ _id: 'reply1', text: 'Totally agree!', username: 'pan' }),
      ]);
      expect(res.body.comments[0].hasMoreReplies).toBe(false);
    });

    // Replies are never separately paginated within listComments itself —
    // attachReplies embeds only the first REPLIES_PAGE_SIZE per comment and
    // flags the rest via hasMoreReplies, fetched on demand through
    // listReplies (see the describe block below) instead of an unbounded
    // payload.
    test('sets hasMoreReplies when a comment has more than REPLIES_PAGE_SIZE replies', async () => {
      authAs(OWNER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      jest.spyOn(Page, 'findOne').mockResolvedValue({ _id: PAGE_ID, album: ALBUM_ID });
      const replies = Array.from({ length: Comment.REPLIES_PAGE_SIZE + 1 }, (_, i) =>
        fakeComment({ _id: `reply-${i}`, text: `Reply ${i}`, parentComment: COMMENT_ID, user: OWNER_ID })
      );
      mockCommentFind([fakeComment({ _id: COMMENT_ID, text: 'Lovely!' })], replies);
      jest.spyOn(User, 'find').mockResolvedValue([{ _id: OWNER_ID, username: 'pan', avatarFilename: null }]);

      const res = await request(app)
        .get(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/comments`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.comments[0].hasMoreReplies).toBe(true);
      expect(res.body.comments[0].replies).toHaveLength(Comment.REPLIES_PAGE_SIZE);
      // Oldest-first, so the (N+1)th (extra) reply — the newest — is the one
      // dropped from this first page, not an arbitrary one.
      expect(res.body.comments[0].replies[0]).toMatchObject({ _id: 'reply-0' });
    });

    test('200 returns hasMore: true and only a page\'s worth of comments when there are more', async () => {
      authAs(OWNER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      jest.spyOn(Page, 'findOne').mockResolvedValue({ _id: PAGE_ID, album: ALBUM_ID });
      // One more than COMMENTS_PAGE_SIZE, newest-first (as the controller
      // requests) — the extra document signals there's another page.
      const newestFirst = Array.from({ length: Comment.COMMENTS_PAGE_SIZE + 1 }, (_, i) =>
        fakeComment({ _id: `comment-${i}`, text: `Comment ${i}` })
      );
      mockCommentFind(newestFirst);
      jest.spyOn(User, 'find').mockResolvedValue([{ _id: OTHER_ID, username: 'maria', avatarFilename: null }]);

      const res = await request(app)
        .get(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/comments`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.hasMore).toBe(true);
      expect(res.body.comments).toHaveLength(Comment.COMMENTS_PAGE_SIZE);
      // The 21st (extra) newest-first document is dropped, and the
      // remaining page is reversed back to oldest-first for display — same
      // as the unpaginated response always was.
      expect(res.body.comments[0]).toMatchObject({ _id: `comment-${Comment.COMMENTS_PAGE_SIZE - 1}` });
    });

    test('passes a valid `before` cursor through as a createdAt filter', async () => {
      authAs(OWNER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      jest.spyOn(Page, 'findOne').mockResolvedValue({ _id: PAGE_ID, album: ALBUM_ID });
      jest.spyOn(User, 'find').mockResolvedValue([]);
      const findSpy = jest.spyOn(Comment, 'find').mockReturnValue({
        sort: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue([]) }),
      });

      const before = new Date('2025-01-01T00:00:00.000Z').toISOString();
      const res = await request(app)
        .get(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/comments`)
        .query({ before })
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(findSpy).toHaveBeenCalledWith({
        page: PAGE_ID,
        parentComment: null,
        createdAt: { $lt: new Date(before) },
      });
    });

    test('400 when `before` is not a valid date', async () => {
      authAs(OWNER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      const res = await request(app)
        .get(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/comments`)
        .query({ before: 'not-a-date' })
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
    });

    test('400 when `beforeId` is not a valid id', async () => {
      authAs(OWNER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      const before = new Date('2025-01-01T00:00:00.000Z').toISOString();
      const res = await request(app)
        .get(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/comments`)
        .query({ before, beforeId: 'not-an-id' })
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
    });

    test('passing `before` with `beforeId` tiebreaks comments sharing the exact same createdAt', async () => {
      authAs(OWNER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      jest.spyOn(Page, 'findOne').mockResolvedValue({ _id: PAGE_ID, album: ALBUM_ID });
      jest.spyOn(User, 'find').mockResolvedValue([]);
      const findSpy = jest.spyOn(Comment, 'find').mockReturnValue({
        sort: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue([]) }),
      });

      const before = new Date('2025-01-01T00:00:00.000Z').toISOString();
      const beforeId = COMMENT_ID;
      const res = await request(app)
        .get(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/comments`)
        .query({ before, beforeId })
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(findSpy).toHaveBeenCalledWith({
        page: PAGE_ID,
        parentComment: null,
        $or: [{ createdAt: { $lt: new Date(before) } }, { createdAt: new Date(before), _id: { $lt: beforeId } }],
      });
    });
  });

  describe('GET /api/albums/:id/pages/:pageId/comments/:commentId/replies', () => {
    const fakeComment = (overrides) => ({
      page: PAGE_ID,
      user: OTHER_ID,
      toJSON() {
        const { toJSON: _drop, ...rest } = this;
        return rest;
      },
      ...overrides,
    });

    test('401 without a token', async () => {
      const res = await request(app).get(
        `/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/comments/${COMMENT_ID}/replies`
      );
      expect(res.status).toBe(401);
    });

    test('403 when a stranger requests replies on a private album\'s photo', async () => {
      authAs(OTHER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      const res = await request(app)
        .get(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/comments/${COMMENT_ID}/replies`)
        .set('Authorization', `Bearer ${strangerToken}`);
      expect(res.status).toBe(403);
    });

    test('404 when the photo does not belong to the album', async () => {
      authAs(OWNER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      jest.spyOn(Page, 'findOne').mockResolvedValue(null);
      const res = await request(app)
        .get(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/comments/${COMMENT_ID}/replies`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    test('404 when the comment does not exist on this page', async () => {
      authAs(OWNER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      jest.spyOn(Page, 'findOne').mockResolvedValue({ _id: PAGE_ID, album: ALBUM_ID });
      jest.spyOn(Comment, 'findOne').mockResolvedValue(null);
      const res = await request(app)
        .get(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/comments/${COMMENT_ID}/replies`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    // Replies are exactly one level deep — "load more replies" only makes
    // sense for a genuine top-level comment. The controller's own
    // Comment.findOne includes parentComment: null, so a real reply's id
    // here simply never matches, surfacing as the same 404 as a
    // nonexistent id rather than a separate error branch.
    test('404 when the given id belongs to a reply, not a top-level comment', async () => {
      authAs(OWNER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      jest.spyOn(Page, 'findOne').mockResolvedValue({ _id: PAGE_ID, album: ALBUM_ID });
      const findOneSpy = jest.spyOn(Comment, 'findOne').mockResolvedValue(null);
      const res = await request(app)
        .get(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/comments/${REPLIER_ID}/replies`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
      expect(findOneSpy).toHaveBeenCalledWith({ _id: REPLIER_ID, page: PAGE_ID, parentComment: null });
    });

    test('400 when `after` is not a valid date', async () => {
      authAs(OWNER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      const res = await request(app)
        .get(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/comments/${COMMENT_ID}/replies`)
        .query({ after: 'not-a-date' })
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
    });

    test('400 when `afterId` is not a valid id', async () => {
      authAs(OWNER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      const after = new Date('2025-01-01T00:00:00.000Z').toISOString();
      const res = await request(app)
        .get(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/comments/${COMMENT_ID}/replies`)
        .query({ after, afterId: 'not-an-id' })
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
    });

    test('200 returns the next portion of replies, oldest-first, with authors resolved', async () => {
      authAs(OWNER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      jest.spyOn(Page, 'findOne').mockResolvedValue({ _id: PAGE_ID, album: ALBUM_ID });
      jest.spyOn(Comment, 'findOne').mockResolvedValue({ _id: COMMENT_ID, page: PAGE_ID, parentComment: null });
      jest.spyOn(Comment, 'find').mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([
            fakeComment({ _id: 'reply2', text: 'Next portion', parentComment: COMMENT_ID, user: OTHER_ID }),
          ]),
        }),
      });
      jest.spyOn(User, 'find').mockResolvedValue([{ _id: OTHER_ID, username: 'maria', avatarFilename: null }]);

      const res = await request(app)
        .get(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/comments/${COMMENT_ID}/replies`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.replies).toEqual([
        expect.objectContaining({ _id: 'reply2', text: 'Next portion', username: 'maria' }),
      ]);
      expect(res.body.hasMore).toBe(false);
    });

    test('200 returns hasMore: true and only a page\'s worth of replies when there are more', async () => {
      authAs(OWNER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      jest.spyOn(Page, 'findOne').mockResolvedValue({ _id: PAGE_ID, album: ALBUM_ID });
      jest.spyOn(Comment, 'findOne').mockResolvedValue({ _id: COMMENT_ID, page: PAGE_ID, parentComment: null });
      // One more than REPLIES_PAGE_SIZE, oldest-first (as the controller
      // requests) — the extra document signals there's another portion.
      const oldestFirst = Array.from({ length: Comment.REPLIES_PAGE_SIZE + 1 }, (_, i) =>
        fakeComment({ _id: `reply-${i}`, text: `Reply ${i}`, parentComment: COMMENT_ID, user: OTHER_ID })
      );
      jest.spyOn(Comment, 'find').mockReturnValue({
        sort: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue(oldestFirst) }),
      });
      jest.spyOn(User, 'find').mockResolvedValue([{ _id: OTHER_ID, username: 'maria', avatarFilename: null }]);

      const res = await request(app)
        .get(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/comments/${COMMENT_ID}/replies`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.hasMore).toBe(true);
      expect(res.body.replies).toHaveLength(Comment.REPLIES_PAGE_SIZE);
      // The (N+1)th (extra, newest) reply is dropped from this portion.
      expect(res.body.replies[0]).toMatchObject({ _id: 'reply-0' });
    });

    test('passes a valid `after` cursor through as a createdAt filter', async () => {
      authAs(OWNER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      jest.spyOn(Page, 'findOne').mockResolvedValue({ _id: PAGE_ID, album: ALBUM_ID });
      jest.spyOn(Comment, 'findOne').mockResolvedValue({ _id: COMMENT_ID, page: PAGE_ID, parentComment: null });
      jest.spyOn(User, 'find').mockResolvedValue([]);
      const findSpy = jest.spyOn(Comment, 'find').mockReturnValue({
        sort: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue([]) }),
      });

      const after = new Date('2025-01-01T00:00:00.000Z').toISOString();
      const res = await request(app)
        .get(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/comments/${COMMENT_ID}/replies`)
        .query({ after })
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(findSpy).toHaveBeenCalledWith({
        parentComment: COMMENT_ID,
        createdAt: { $gt: new Date(after) },
      });
    });

    test('passing `after` with `afterId` tiebreaks replies sharing the exact same createdAt', async () => {
      authAs(OWNER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      jest.spyOn(Page, 'findOne').mockResolvedValue({ _id: PAGE_ID, album: ALBUM_ID });
      jest.spyOn(Comment, 'findOne').mockResolvedValue({ _id: COMMENT_ID, page: PAGE_ID, parentComment: null });
      jest.spyOn(User, 'find').mockResolvedValue([]);
      const findSpy = jest.spyOn(Comment, 'find').mockReturnValue({
        sort: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue([]) }),
      });

      const after = new Date('2025-01-01T00:00:00.000Z').toISOString();
      const afterId = REPLIER_ID;
      const res = await request(app)
        .get(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/comments/${COMMENT_ID}/replies`)
        .query({ after, afterId })
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(findSpy).toHaveBeenCalledWith({
        parentComment: COMMENT_ID,
        $or: [{ createdAt: { $gt: new Date(after) } }, { createdAt: new Date(after), _id: { $gt: afterId } }],
      });
    });
  });

  describe('POST /api/albums/:id/pages/:pageId/comments', () => {
    beforeEach(() => {
      jest.spyOn(Notification, 'create').mockResolvedValue({ _id: 'notif1' });
      jest.spyOn(Notification, 'pruneExcessForRecipient').mockResolvedValue(null);
      jest.spyOn(User, 'find').mockResolvedValue([{ _id: OWNER_ID, username: 'pan', avatarFilename: null }]);
    });

    test('401 without a token', async () => {
      const res = await request(app).post(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/comments`);
      expect(res.status).toBe(401);
    });

    test('403 when a stranger comments on a private album', async () => {
      authAs(OTHER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      const res = await request(app)
        .post(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/comments`)
        .set('Authorization', `Bearer ${strangerToken}`)
        .send({ text: 'Lovely!' });
      expect(res.status).toBe(403);
    });

    test('400 for empty text', async () => {
      authAs(OWNER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      const res = await request(app)
        .post(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/comments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ text: '   ' });
      expect(res.status).toBe(400);
    });

    test('400 for text over the max length', async () => {
      authAs(OWNER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      const res = await request(app)
        .post(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/comments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ text: 'x'.repeat(1001) });
      expect(res.status).toBe(400);
    });

    test('404 when the photo does not belong to the album', async () => {
      authAs(OWNER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      jest.spyOn(Page, 'findOne').mockResolvedValue(null);
      const res = await request(app)
        .post(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/comments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ text: 'Lovely!' });
      expect(res.status).toBe(404);
    });

    test('201 saves the comment, returns the fresh count, and notifies the album owner', async () => {
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
      jest.spyOn(Comment, 'create').mockResolvedValue({
        _id: COMMENT_ID,
        page: PAGE_ID,
        user: OTHER_ID,
        text: 'Lovely!',
        toJSON() {
          const { toJSON: _drop, ...rest } = this;
          return rest;
        },
      });
      jest.spyOn(Comment, 'countDocuments').mockResolvedValue(1);

      const res = await request(app)
        .post(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/comments`)
        .set('Authorization', `Bearer ${strangerToken}`)
        .send({ text: 'Lovely!' });

      expect(res.status).toBe(201);
      expect(res.body.commentCount).toBe(1);
      expect(res.body.comment).toEqual(expect.objectContaining({ text: 'Lovely!' }));
      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({ recipient: OWNER_ID, type: 'page_comment', commentText: 'Lovely!' })
      );
    });

    test('does not notify anyone when the album owner comments on their own photo', async () => {
      authAs(OWNER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      jest.spyOn(Page, 'findOne').mockResolvedValue({ _id: PAGE_ID, filename: 'a.jpg' });
      jest.spyOn(Comment, 'create').mockResolvedValue({
        _id: COMMENT_ID,
        page: PAGE_ID,
        user: OWNER_ID,
        text: 'My own photo',
        toJSON() {
          const { toJSON: _drop, ...rest } = this;
          return rest;
        },
      });
      jest.spyOn(Comment, 'countDocuments').mockResolvedValue(1);

      const res = await request(app)
        .post(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/comments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ text: 'My own photo' });

      expect(res.status).toBe(201);
      expect(Notification.create).not.toHaveBeenCalled();
    });

    test('400 for a parentComment that is not a valid comment id', async () => {
      authAs(OWNER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      const res = await request(app)
        .post(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/comments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ text: 'Nice!', parentComment: 'not-an-id' });
      expect(res.status).toBe(400);
    });

    test('404 when parentComment does not exist on this page', async () => {
      authAs(OWNER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      jest.spyOn(Page, 'findOne').mockResolvedValue({ _id: PAGE_ID, filename: 'a.jpg' });
      jest.spyOn(Comment, 'findOne').mockResolvedValue(null);
      const res = await request(app)
        .post(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/comments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ text: 'Nice!', parentComment: COMMENT_ID });
      expect(res.status).toBe(404);
    });

    test('400 when replying to a reply (one level deep only)', async () => {
      authAs(OWNER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      jest.spyOn(Page, 'findOne').mockResolvedValue({ _id: PAGE_ID, filename: 'a.jpg' });
      jest.spyOn(Comment, 'findOne').mockResolvedValue({
        _id: 'reply1',
        page: PAGE_ID,
        user: OTHER_ID,
        parentComment: COMMENT_ID,
      });
      const res = await request(app)
        .post(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/comments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ text: 'Nice!', parentComment: 'reply1' });
      expect(res.status).toBe(400);
    });

    test('201 saves a reply and notifies the parent comment\'s author, not the album owner', async () => {
      authAs(OWNER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      jest.spyOn(Page, 'findOne').mockResolvedValue({ _id: PAGE_ID, filename: 'a.jpg' });
      jest.spyOn(Comment, 'findOne').mockResolvedValue({
        _id: COMMENT_ID,
        page: PAGE_ID,
        user: OTHER_ID,
        parentComment: null,
      });
      jest.spyOn(Comment, 'create').mockResolvedValue({
        _id: 'reply1',
        page: PAGE_ID,
        user: OWNER_ID,
        text: 'Thanks!',
        parentComment: COMMENT_ID,
        toJSON() {
          const { toJSON: _drop, ...rest } = this;
          return rest;
        },
      });
      jest.spyOn(Comment, 'countDocuments').mockResolvedValue(2);

      const res = await request(app)
        .post(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/comments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ text: 'Thanks!', parentComment: COMMENT_ID });

      expect(res.status).toBe(201);
      expect(res.body.comment).toEqual(expect.objectContaining({ text: 'Thanks!', parentComment: COMMENT_ID }));
      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({ recipient: OTHER_ID, type: 'comment_reply', commentText: 'Thanks!' })
      );
      // The reply notifies the parent's author only — asserting no
      // page_comment notification also fired covers the album owner (the
      // replier here) not getting a second, redundant notification.
      expect(Notification.create).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'page_comment' }));
    });

    test('with three distinct people (owner, parent comment author, replier), only the parent author is notified', async () => {
      authAs(REPLIER_ID);
      const album = fakeAlbum({ visibility: 'shared', sharedWithCircle: '507f1f77bcf86cd799439099' });
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      jest.spyOn(Circle, 'findById').mockResolvedValue(
        new Circle({
          name: 'Family',
          owner: OWNER_ID,
          members: [{ user: REPLIER_ID, status: 'accepted' }],
        })
      );
      jest.spyOn(Page, 'findOne').mockResolvedValue({ _id: PAGE_ID, filename: 'a.jpg' });
      // The parent comment's author (OTHER_ID) is neither the album owner
      // nor the replier — the scenario a "reply also notifies the owner"
      // regression would slip past the other reply tests, which only ever
      // have two distinct identities in play.
      jest.spyOn(Comment, 'findOne').mockResolvedValue({
        _id: COMMENT_ID,
        page: PAGE_ID,
        user: OTHER_ID,
        parentComment: null,
      });
      jest.spyOn(Comment, 'create').mockResolvedValue({
        _id: 'reply1',
        page: PAGE_ID,
        user: REPLIER_ID,
        text: 'Me too!',
        parentComment: COMMENT_ID,
        toJSON() {
          const { toJSON: _drop, ...rest } = this;
          return rest;
        },
      });
      jest.spyOn(Comment, 'countDocuments').mockResolvedValue(2);

      const res = await request(app)
        .post(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/comments`)
        .set('Authorization', `Bearer ${replierToken}`)
        .send({ text: 'Me too!', parentComment: COMMENT_ID });

      expect(res.status).toBe(201);
      expect(Notification.create).toHaveBeenCalledTimes(1);
      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({ recipient: OTHER_ID, type: 'comment_reply' })
      );
      expect(Notification.create).not.toHaveBeenCalledWith(expect.objectContaining({ recipient: OWNER_ID }));
    });

    test('does not notify anyone when replying to your own comment', async () => {
      authAs(OWNER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      jest.spyOn(Page, 'findOne').mockResolvedValue({ _id: PAGE_ID, filename: 'a.jpg' });
      jest.spyOn(Comment, 'findOne').mockResolvedValue({
        _id: COMMENT_ID,
        page: PAGE_ID,
        user: OWNER_ID,
        parentComment: null,
      });
      jest.spyOn(Comment, 'create').mockResolvedValue({
        _id: 'reply1',
        page: PAGE_ID,
        user: OWNER_ID,
        text: 'Adding more context',
        parentComment: COMMENT_ID,
        toJSON() {
          const { toJSON: _drop, ...rest } = this;
          return rest;
        },
      });
      jest.spyOn(Comment, 'countDocuments').mockResolvedValue(2);

      const res = await request(app)
        .post(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/comments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ text: 'Adding more context', parentComment: COMMENT_ID });

      expect(res.status).toBe(201);
      expect(Notification.create).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /api/albums/:id/pages/:pageId/comments/:commentId', () => {
    test('404 when the comment does not belong to the photo', async () => {
      authAs(OWNER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      jest.spyOn(Page, 'findOne').mockResolvedValue({ _id: PAGE_ID, album: ALBUM_ID });
      jest.spyOn(Comment, 'findOne').mockResolvedValue(null);
      const res = await request(app)
        .delete(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/comments/${COMMENT_ID}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    test('403 when a non-author, non-owner viewer tries to delete someone else\'s comment', async () => {
      authAs(OTHER_ID);
      const album = fakeAlbum({ visibility: 'public' });
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      jest.spyOn(Page, 'findOne').mockResolvedValue({ _id: PAGE_ID, album: ALBUM_ID });
      jest.spyOn(Comment, 'findOne').mockResolvedValue({
        _id: COMMENT_ID,
        page: PAGE_ID,
        user: { toString: () => OWNER_ID },
        deleteOne: jest.fn(),
      });
      const res = await request(app)
        .delete(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/comments/${COMMENT_ID}`)
        .set('Authorization', `Bearer ${strangerToken}`);
      expect(res.status).toBe(403);
    });

    test('200 when the comment author deletes their own comment', async () => {
      authAs(OTHER_ID);
      const album = fakeAlbum({ visibility: 'public' });
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      jest.spyOn(Page, 'findOne').mockResolvedValue({ _id: PAGE_ID, album: ALBUM_ID });
      const deleteOne = jest.fn().mockResolvedValue({});
      jest.spyOn(Comment, 'findOne').mockResolvedValue({
        _id: COMMENT_ID,
        page: PAGE_ID,
        user: { toString: () => OTHER_ID },
        deleteOne,
      });
      jest.spyOn(Comment, 'countDocuments').mockResolvedValue(0);

      const res = await request(app)
        .delete(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/comments/${COMMENT_ID}`)
        .set('Authorization', `Bearer ${strangerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ deleted: true, commentCount: 0 });
      expect(deleteOne).toHaveBeenCalled();
    });

    test('200 when the album owner deletes someone else\'s comment', async () => {
      authAs(OWNER_ID);
      const album = fakeAlbum();
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      jest.spyOn(Page, 'findOne').mockResolvedValue({ _id: PAGE_ID, album: ALBUM_ID });
      const deleteOne = jest.fn().mockResolvedValue({});
      jest.spyOn(Comment, 'findOne').mockResolvedValue({
        _id: COMMENT_ID,
        page: PAGE_ID,
        user: { toString: () => OTHER_ID },
        deleteOne,
      });
      jest.spyOn(Comment, 'countDocuments').mockResolvedValue(0);

      const res = await request(app)
        .delete(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/comments/${COMMENT_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(deleteOne).toHaveBeenCalled();
    });

    test('200 cascades to delete the comment\'s own replies and every reaction on the comment and its replies', async () => {
      authAs(OTHER_ID);
      const album = fakeAlbum({ visibility: 'public' });
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      jest.spyOn(Page, 'findOne').mockResolvedValue({ _id: PAGE_ID, album: ALBUM_ID });
      const deleteOne = jest.fn().mockResolvedValue({});
      jest.spyOn(Comment, 'findOne').mockResolvedValue({
        _id: COMMENT_ID,
        page: PAGE_ID,
        user: { toString: () => OTHER_ID },
        deleteOne,
      });
      jest.spyOn(Comment, 'countDocuments').mockResolvedValue(0);
      jest.spyOn(Comment, 'find').mockResolvedValue([{ _id: 'reply1' }, { _id: 'reply2' }]);
      const deleteManySpy = jest.spyOn(Comment, 'deleteMany').mockResolvedValue({});
      const commentReactionDeleteManySpy = jest.spyOn(CommentReaction, 'deleteMany').mockResolvedValue({});

      const res = await request(app)
        .delete(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/comments/${COMMENT_ID}`)
        .set('Authorization', `Bearer ${strangerToken}`);

      expect(res.status).toBe(200);
      expect(deleteManySpy).toHaveBeenCalledWith({ parentComment: COMMENT_ID });
      expect(commentReactionDeleteManySpy).toHaveBeenCalledWith({
        comment: { $in: [COMMENT_ID, 'reply1', 'reply2'] },
      });
    });
  });

  describe('PUT /api/albums/:id/pages/:pageId/comments/:commentId/reaction', () => {
    beforeEach(() => {
      jest.spyOn(Notification, 'create').mockResolvedValue({ _id: 'notif1' });
      jest.spyOn(Notification, 'pruneExcessForRecipient').mockResolvedValue(null);
    });

    test('401 without a token', async () => {
      const res = await request(app).put(
        `/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/comments/${COMMENT_ID}/reaction`
      );
      expect(res.status).toBe(401);
    });

    test('403 when a stranger reacts on a private album', async () => {
      authAs(OTHER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      const res = await request(app)
        .put(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/comments/${COMMENT_ID}/reaction`)
        .set('Authorization', `Bearer ${strangerToken}`)
        .send({ type: 'like' });
      expect(res.status).toBe(403);
    });

    test('400 for a type outside the enum', async () => {
      authAs(OWNER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      const res = await request(app)
        .put(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/comments/${COMMENT_ID}/reaction`)
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'shrug' });
      expect(res.status).toBe(400);
    });

    test('404 when the photo does not belong to the album', async () => {
      authAs(OWNER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      jest.spyOn(Page, 'findOne').mockResolvedValue(null);
      const res = await request(app)
        .put(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/comments/${COMMENT_ID}/reaction`)
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'like' });
      expect(res.status).toBe(404);
    });

    test('404 when the comment does not belong to the photo', async () => {
      authAs(OWNER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      jest.spyOn(Page, 'findOne').mockResolvedValue({ _id: PAGE_ID, filename: 'a.jpg' });
      jest.spyOn(Comment, 'findOne').mockResolvedValue(null);
      const res = await request(app)
        .put(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/comments/${COMMENT_ID}/reaction`)
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'like' });
      expect(res.status).toBe(404);
    });

    test('a reader can react to someone else\'s comment on a public album, and the comment author is notified', async () => {
      authAs(OTHER_ID);
      const album = fakeAlbum({ visibility: 'public' });
      jest.spyOn(Album, 'findById').mockResolvedValue(album);
      jest.spyOn(Page, 'findOne').mockResolvedValue({ _id: PAGE_ID, filename: 'a.jpg' });
      jest.spyOn(Comment, 'findOne').mockResolvedValue({
        _id: COMMENT_ID,
        page: PAGE_ID,
        text: 'Lovely!',
        user: OWNER_ID,
      });
      jest.spyOn(CommentReaction, 'findOne').mockResolvedValue(null);
      jest.spyOn(CommentReaction, 'create').mockResolvedValue({});

      const res = await request(app)
        .put(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/comments/${COMMENT_ID}/reaction`)
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
        expect.objectContaining({ recipient: OWNER_ID, type: 'comment_reaction', reactionType: 'love', commentText: 'Lovely!' })
      );
    });

    test('does not notify anyone when reacting to your own comment', async () => {
      authAs(OWNER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      jest.spyOn(Page, 'findOne').mockResolvedValue({ _id: PAGE_ID, filename: 'a.jpg' });
      jest.spyOn(Comment, 'findOne').mockResolvedValue({
        _id: COMMENT_ID,
        page: PAGE_ID,
        text: 'My own comment',
        user: OWNER_ID,
      });
      jest.spyOn(CommentReaction, 'findOne').mockResolvedValue(null);
      jest.spyOn(CommentReaction, 'create').mockResolvedValue({});

      const res = await request(app)
        .put(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/comments/${COMMENT_ID}/reaction`)
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'like' });

      expect(res.status).toBe(200);
      expect(Notification.create).not.toHaveBeenCalled();
    });

    test('picking the same reaction twice removes it', async () => {
      authAs(OWNER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      jest.spyOn(Page, 'findOne').mockResolvedValue({ _id: PAGE_ID, filename: 'a.jpg' });
      jest.spyOn(Comment, 'findOne').mockResolvedValue({
        _id: COMMENT_ID,
        page: PAGE_ID,
        text: 'Lovely!',
        user: OTHER_ID,
      });
      const deleteOne = jest.fn().mockResolvedValue({});
      jest.spyOn(CommentReaction, 'findOne').mockResolvedValue({ type: 'like', deleteOne });

      const res = await request(app)
        .put(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/comments/${COMMENT_ID}/reaction`)
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'like' });

      expect(res.status).toBe(200);
      expect(deleteOne).toHaveBeenCalled();
    });

    // Regression test for a race where a concurrent deleteComment removes
    // the comment (and cascades its CommentReaction rows) while this
    // request is still writing its own reaction — without the post-write
    // existence check, that write would survive as an orphaned row
    // referencing a comment that no longer exists.
    test('cleans up its own reaction and 404s when the comment was deleted concurrently', async () => {
      authAs(OWNER_ID);
      jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
      jest.spyOn(Page, 'findOne').mockResolvedValue({ _id: PAGE_ID, filename: 'a.jpg' });
      jest.spyOn(Comment, 'findOne').mockResolvedValue({
        _id: COMMENT_ID,
        page: PAGE_ID,
        text: 'Lovely!',
        user: OTHER_ID,
      });
      jest.spyOn(CommentReaction, 'findOne').mockResolvedValue(null);
      jest.spyOn(CommentReaction, 'create').mockResolvedValue({});
      jest.spyOn(Comment, 'exists').mockResolvedValue(false);

      const res = await request(app)
        .put(`/api/albums/${ALBUM_ID}/pages/${PAGE_ID}/comments/${COMMENT_ID}/reaction`)
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'like' });

      expect(res.status).toBe(404);
      expect(CommentReaction.deleteMany).toHaveBeenCalledWith({ comment: COMMENT_ID, user: OWNER_ID });
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
