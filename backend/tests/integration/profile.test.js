const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const OWNER_ID = '507f1f77bcf86cd799439011';

describe('profile routes (integration)', () => {
  let app;
  let tmpRoot;
  let User;
  let auth;
  let signedUrl;
  let token;

  function expectSignedAvatarUrl(url, expectedPathname) {
    const parsed = new URL(url, 'http://localhost');
    expect(parsed.pathname).toBe(expectedPathname);
    expect(
      signedUrl.verify(parsed.pathname, parsed.searchParams.get('exp'), parsed.searchParams.get('sig'))
    ).toBe(true);
  }

  // Old-avatar cleanup is deliberately fire-and-forget fs.rm (see
  // users-controller.uploadAvatar/removeAvatar) — the HTTP response can
  // resolve before the deletion lands on disk, so assertions on disk state
  // need to poll instead of checking immediately after the response.
  function waitFor(predicate, { timeoutMs = 1000, intervalMs = 10 } = {}) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const check = () => {
        if (predicate()) return resolve();
        if (Date.now() - start > timeoutMs) return reject(new Error('waitFor timed out'));
        setTimeout(check, intervalMs);
      };
      check();
    });
  }

  beforeAll(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'folia-uploads-'));
    process.env.UPLOADS_DIR = tmpRoot;

    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    // Required only now, after UPLOADS_DIR is set — settings.js reads env
    // vars once at first require and caches the result.
    User = require('../../server/data/User');
    auth = require('../../server/config/auth');
    signedUrl = require('../../server/utilities/signed-url');

    const express = require('express');
    app = express();
    require('../../server/config/express')(app);
    require('../../server/config/routes')(app);

    token = auth.signToken({ _id: OWNER_ID, username: 'pan' });
  });

  afterAll(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    delete process.env.UPLOADS_DIR;
  });

  const fakeUser = (overrides = {}) => ({
    _id: OWNER_ID,
    username: 'pan',
    email: 'pan@test.com',
    roles: ['User'],
    avatarFilename: undefined,
    save: jest.fn().mockImplementation(function () {
      return Promise.resolve(this);
    }),
    ...overrides,
  });

  const authAs = (user) => {
    jest.spyOn(User, 'findById').mockResolvedValue(user);
    // Mirrors the real atomic conditional update the avatar handlers use:
    // only "succeeds" if the filter's avatarFilename still matches the
    // fake user's current one, and mutates it in place like a real update.
    jest.spyOn(User, 'findOneAndUpdate').mockImplementation((filter, update) => {
      const currentForMatch = user.avatarFilename ?? null;
      if (filter.avatarFilename !== currentForMatch) return Promise.resolve(null);
      Object.assign(user, update);
      return Promise.resolve({ ...user });
    });
  };

  describe('PUT /api/users/me', () => {
    test('401 without a token', async () => {
      const res = await request(app).put('/api/users/me').send({ username: 'newname' });
      expect(res.status).toBe(401);
    });

    test('400 when neither username nor email is provided', async () => {
      authAs(fakeUser());
      const res = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(400);
    });

    test('400 for an invalid email', async () => {
      authAs(fakeUser());
      const res = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'not-an-email' });
      expect(res.status).toBe(400);
    });

    test('200 updates the username and returns the user', async () => {
      authAs(fakeUser());
      const res = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ username: 'newname' });
      expect(res.status).toBe(200);
      expect(res.body.user.username).toBe('newname');
    });

    test('400 maps a duplicate username to a friendly error', async () => {
      authAs(
        fakeUser({
          save: jest.fn().mockRejectedValue({ code: 11000, keyValue: { username: 'taken' } }),
        })
      );
      const res = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ username: 'taken' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('username already exists');
    });
  });

  describe('POST /api/users/me/avatar', () => {
    beforeEach(() => {
      // Each test writes real files to disk — start from a clean folder so
      // counts/assertions below aren't polluted by a previous test's files.
      fs.rmSync(path.join(tmpRoot, 'avatars', OWNER_ID), { recursive: true, force: true });
    });

    test('401 without a token', async () => {
      const res = await request(app)
        .post('/api/users/me/avatar')
        .attach('avatar', Buffer.from('fake'), 'a.jpg');
      expect(res.status).toBe(401);
    });

    test('400 when no file is attached', async () => {
      authAs(fakeUser());
      const res = await request(app)
        .post('/api/users/me/avatar')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
    });

    test('400 for an unsupported file type', async () => {
      authAs(fakeUser());
      const res = await request(app)
        .post('/api/users/me/avatar')
        .set('Authorization', `Bearer ${token}`)
        .attach('avatar', Buffer.from('not an image'), 'notes.txt');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/supported/i);
    });

    test('413 for a photo over the size limit', async () => {
      authAs(fakeUser());
      const oversized = Buffer.alloc(10 * 1024 * 1024 + 1);
      const res = await request(app)
        .post('/api/users/me/avatar')
        .set('Authorization', `Bearer ${token}`)
        .attach('avatar', oversized, 'huge.jpg');
      expect(res.status).toBe(413);
    });

    test('200 saves the file to disk and returns a signed avatarUrl', async () => {
      authAs(fakeUser());
      const res = await request(app)
        .post('/api/users/me/avatar')
        .set('Authorization', `Bearer ${token}`)
        .attach('avatar', Buffer.from('fake-jpeg-bytes'), 'a.jpg');

      expect(res.status).toBe(200);
      const parsed = new URL(res.body.user.avatarUrl, 'http://localhost');
      expect(parsed.pathname).toMatch(new RegExp(`^/uploads/avatars/${OWNER_ID}/.+\\.jpg$`));
      expectSignedAvatarUrl(res.body.user.avatarUrl, parsed.pathname);

      const avatarFolder = path.join(tmpRoot, 'avatars', OWNER_ID);
      expect(fs.readdirSync(avatarFolder)).toHaveLength(1);
    });

    test('re-uploading deletes the previous file from disk', async () => {
      authAs(fakeUser());
      const first = await request(app)
        .post('/api/users/me/avatar')
        .set('Authorization', `Bearer ${token}`)
        .attach('avatar', Buffer.from('fake-jpeg-bytes'), 'a.jpg');
      const firstFilename = path.basename(new URL(first.body.user.avatarUrl, 'http://localhost').pathname);

      // Re-authenticate as the same user, now carrying the previously-saved filename.
      authAs(fakeUser({ avatarFilename: firstFilename }));
      await request(app)
        .post('/api/users/me/avatar')
        .set('Authorization', `Bearer ${token}`)
        .attach('avatar', Buffer.from('other-jpeg-bytes'), 'b.jpg');

      const avatarFolder = path.join(tmpRoot, 'avatars', OWNER_ID);
      await waitFor(() => fs.readdirSync(avatarFolder).length === 1);
      expect(fs.readdirSync(avatarFolder)).not.toContain(firstFilename);
    });

    // Keep last: exhausts the shared rate limiter for this route
    test('429s after the upload rate limit is exhausted', async () => {
      authAs(fakeUser());
      let last;
      for (let i = 0; i < 25; i++) {
        last = await request(app)
          .post('/api/users/me/avatar')
          .set('Authorization', `Bearer ${token}`)
          .attach('avatar', Buffer.from('not an image'), 'notes.txt');
      }
      expect(last.status).toBe(429);
      expect(last.body).toEqual({ error: 'Too many uploads, try again later' });
    });
  });

  describe('DELETE /api/users/me/avatar', () => {
    test('401 without a token', async () => {
      const res = await request(app).delete('/api/users/me/avatar');
      expect(res.status).toBe(401);
    });

    test('200 no-op when the user has no avatar', async () => {
      authAs(fakeUser());
      const res = await request(app)
        .delete('/api/users/me/avatar')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.user.avatarUrl).toBeNull();
    });

    test('200 clears the filename and deletes the file from disk', async () => {
      const avatarFolder = path.join(tmpRoot, 'avatars', OWNER_ID);
      fs.mkdirSync(avatarFolder, { recursive: true });
      fs.writeFileSync(path.join(avatarFolder, 'existing.jpg'), 'fake');

      authAs(fakeUser({ avatarFilename: 'existing.jpg' }));
      const res = await request(app)
        .delete('/api/users/me/avatar')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user.avatarUrl).toBeNull();
      await waitFor(() => !fs.existsSync(path.join(avatarFolder, 'existing.jpg')));
    });
  });

  describe('DELETE /api/users/me', () => {
    let Album;
    let Circle;
    let Page;
    let Reaction;
    let AlbumReaction;
    let Comment;
    let CommentReaction;
    let Notification;

    beforeAll(() => {
      Album = require('../../server/data/Album');
      Circle = require('../../server/data/Circle');
      Page = require('../../server/data/Page');
      Reaction = require('../../server/data/Reaction');
      AlbumReaction = require('../../server/data/AlbumReaction');
      Comment = require('../../server/data/Comment');
      CommentReaction = require('../../server/data/CommentReaction');
      Notification = require('../../server/data/Notification');
    });

    beforeEach(() => {
      jest.spyOn(Album, 'find').mockResolvedValue([]);
      jest.spyOn(Circle, 'find').mockResolvedValue([]);
      jest.spyOn(Album, 'updateMany').mockResolvedValue({});
      jest.spyOn(Circle, 'updateMany').mockResolvedValue({});
      jest.spyOn(Page, 'deleteMany').mockResolvedValue({});
      jest.spyOn(Reaction, 'deleteMany').mockResolvedValue({});
      jest.spyOn(AlbumReaction, 'deleteMany').mockResolvedValue({});
      jest.spyOn(Comment, 'deleteMany').mockResolvedValue({});
      jest.spyOn(CommentReaction, 'deleteMany').mockResolvedValue({});
      jest.spyOn(Album, 'deleteMany').mockResolvedValue({});
      jest.spyOn(Circle, 'deleteMany').mockResolvedValue({});
      jest.spyOn(Notification, 'deleteMany').mockResolvedValue({});
      jest.spyOn(User, 'deleteOne').mockResolvedValue({});
    });

    test('401 without a token', async () => {
      const res = await request(app).delete('/api/users/me');
      expect(res.status).toBe(401);
    });

    test('403 for an Admin account, without deleting anything', async () => {
      authAs(fakeUser({ roles: ['Admin'] }));
      const deleteOne = jest.spyOn(User, 'deleteOne');
      const res = await request(app).delete('/api/users/me').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
      expect(deleteOne).not.toHaveBeenCalled();
    });

    test('200 deletes the account and removes its upload + avatar folders from disk', async () => {
      const userFolder = path.join(tmpRoot, OWNER_ID);
      const avatarFolder = path.join(tmpRoot, 'avatars', OWNER_ID);
      fs.mkdirSync(path.join(userFolder, 'some-album-id'), { recursive: true });
      fs.writeFileSync(path.join(userFolder, 'some-album-id', 'photo.jpg'), 'fake');
      fs.mkdirSync(avatarFolder, { recursive: true });
      fs.writeFileSync(path.join(avatarFolder, 'existing.jpg'), 'fake');

      authAs(fakeUser({ avatarFilename: 'existing.jpg' }));
      const res = await request(app).delete('/api/users/me').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ deleted: true });
      expect(fs.existsSync(userFolder)).toBe(false);
      expect(fs.existsSync(avatarFolder)).toBe(false);
    });

    test('500 when a cascade step fails', async () => {
      authAs(fakeUser());
      jest.spyOn(Album, 'deleteMany').mockRejectedValue(new Error('db down'));
      const res = await request(app).delete('/api/users/me').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(500);
    });
  });
});
