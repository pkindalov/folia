const fs = require('fs');
const User = require('../../server/data/User');
const controller = require('../../server/controllers/users-controller');

const flush = () => new Promise(setImmediate);

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const VALID_REGISTER = { username: 'pan', email: 'pan@test.com', password: 'secret123' };

describe('users-controller', () => {
  describe('register — input validation', () => {
    test.each([
      ['empty body', {}],
      ['missing username', { email: 'a@b.com', password: 'secret123' }],
      ['missing email', { username: 'pan', password: 'secret123' }],
      ['missing password', { username: 'pan', email: 'a@b.com' }],
      ['null body', null],
      ['empty strings', { username: '', email: '', password: '' }],
    ])('rejects %s with 400', (_name, body) => {
      const res = mockRes();
      const create = jest.spyOn(User, 'create');
      controller.register({ body }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(create).not.toHaveBeenCalled();
    });

    test.each([
      ['NoSQL operator object as username', { ...VALID_REGISTER, username: { $gt: '' } }],
      ['array as username', { ...VALID_REGISTER, username: ['pan'] }],
      ['number as username', { ...VALID_REGISTER, username: 42 }],
      ['boolean as username', { ...VALID_REGISTER, username: true }],
      ['NoSQL operator object as email', { ...VALID_REGISTER, email: { $ne: '' } }],
      ['NoSQL operator object as password', { ...VALID_REGISTER, password: { $gt: '' } }],
      ['number as password', { ...VALID_REGISTER, password: 12345678 }],
    ])('rejects non-string input: %s (NoSQL injection guard)', (_name, body) => {
      const res = mockRes();
      const create = jest.spyOn(User, 'create');
      controller.register({ body }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(create).not.toHaveBeenCalled();
    });

    test('rejects username shorter than 3 chars', () => {
      const res = mockRes();
      controller.register({ body: { ...VALID_REGISTER, username: 'ab' } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'username must be 3-30 characters' });
    });

    test('rejects username longer than 30 chars', () => {
      const res = mockRes();
      controller.register({ body: { ...VALID_REGISTER, username: 'x'.repeat(31) } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('rejects a username that is too short once trimmed', () => {
      const res = mockRes();
      controller.register({ body: { ...VALID_REGISTER, username: ' ab' } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'username must be 3-30 characters' });
    });

    test('trims surrounding whitespace off the username before creating the user', async () => {
      const create = jest
        .spyOn(User, 'create')
        .mockResolvedValue({ _id: 'id1', username: 'pan' });
      controller.register({ body: { ...VALID_REGISTER, username: '  pan  ' } }, mockRes());
      await flush();
      expect(create.mock.calls[0][0].username).toBe('pan');
    });

    test('accepts boundary usernames (3 and 30 chars)', async () => {
      for (const username of ['abc', 'x'.repeat(30)]) {
        const res = mockRes();
        jest.spyOn(User, 'create').mockResolvedValue({ _id: 'id1', username });
        controller.register({ body: { ...VALID_REGISTER, username } }, res);
        await flush();
        expect(res.status).toHaveBeenCalledWith(201);
      }
    });

    test.each([
      'plainaddress',
      'missing-at.com',
      'no-domain@',
      '@no-local.com',
      'two words@x.com',
      'nodot@domain',
      'trailing@dot.',
    ])('rejects invalid email: "%s"', (email) => {
      const res = mockRes();
      controller.register({ body: { ...VALID_REGISTER, email } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'invalid email address' });
    });

    test('rejects emails longer than 254 chars', () => {
      const res = mockRes();
      const email = `${'a'.repeat(250)}@x.com`;
      controller.register({ body: { ...VALID_REGISTER, email } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('rejects password shorter than 8 chars', () => {
      const res = mockRes();
      controller.register({ body: { ...VALID_REGISTER, password: '1234567' } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'password must be at least 8 characters' });
    });

    test('rejects password longer than 128 chars', () => {
      const res = mockRes();
      controller.register({ body: { ...VALID_REGISTER, password: 'x'.repeat(129) } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('accepts boundary passwords (8 and 128 chars)', async () => {
      for (const password of ['12345678', 'x'.repeat(128)]) {
        const res = mockRes();
        jest.spyOn(User, 'create').mockResolvedValue({ _id: 'id1', username: 'pan' });
        controller.register({ body: { ...VALID_REGISTER, password } }, res);
        await flush();
        expect(res.status).toHaveBeenCalledWith(201);
      }
    });
  });

  describe('register — behavior', () => {
    test('creates the user with a hash, never the plaintext password', async () => {
      const create = jest
        .spyOn(User, 'create')
        .mockResolvedValue({ _id: 'id1', username: 'pan' });
      controller.register({ body: VALID_REGISTER }, mockRes());
      await flush();

      const arg = create.mock.calls[0][0];
      expect(arg).not.toHaveProperty('password');
      expect(arg.salt).toEqual(expect.any(String));
      expect(arg.hashedPass).toMatch(/^[0-9a-f]{128}$/);
      expect(arg.hashedPass).not.toBe(VALID_REGISTER.password);
    });

    test('assigns only the "User" role — role escalation via body is impossible', async () => {
      const create = jest
        .spyOn(User, 'create')
        .mockResolvedValue({ _id: 'id1', username: 'pan' });
      controller.register({ body: { ...VALID_REGISTER, roles: ['Admin'] } }, mockRes());
      await flush();
      expect(create.mock.calls[0][0].roles).toEqual(['User']);
    });

    test('responds 201 with a token and the user', async () => {
      const created = { _id: 'id1', username: 'pan' };
      jest.spyOn(User, 'create').mockResolvedValue(created);
      const res = mockRes();
      controller.register({ body: VALID_REGISTER }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(201);
      const body = res.json.mock.calls[0][0];
      expect(body.user).toEqual({ ...created, avatarUrl: null });
      expect(typeof body.token).toBe('string');
      expect(body.token.split('.')).toHaveLength(3);
    });

    test('maps duplicate-key rejection to a 400 with a friendly message', async () => {
      jest.spyOn(User, 'create').mockRejectedValue({ code: 11000, keyValue: { username: 'pan' } });
      const res = mockRes();
      controller.register({ body: VALID_REGISTER }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'username already exists' });
    });

    test('maps mongoose validation rejection to 400', async () => {
      jest.spyOn(User, 'create').mockRejectedValue({ errors: { email: { message: 'bad email' } } });
      const res = mockRes();
      controller.register({ body: VALID_REGISTER }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'bad email' });
    });
  });

  describe('login', () => {
    test.each([
      ['empty body', {}],
      ['missing password', { identifier: 'pan' }],
      ['missing identifier', { password: 'secret123' }],
      ['object as identifier (injection)', { identifier: { $gt: '' }, password: 'x' }],
      ['object as password (injection)', { identifier: 'pan', password: { $gt: '' } }],
      ['null body', null],
    ])('rejects %s with 400 before touching the DB', (_name, body) => {
      const findOne = jest.spyOn(User, 'findOne');
      const res = mockRes();
      controller.login({ body }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(findOne).not.toHaveBeenCalled();
    });

    test('looks the identifier up as username or lowercased email', async () => {
      const findOne = jest.spyOn(User, 'findOne').mockResolvedValue(null);
      controller.login({ body: { identifier: 'Pan@Test.com', password: 'secret123' } }, mockRes());
      await flush();
      expect(findOne).toHaveBeenCalledWith({
        $or: [{ username: 'Pan@Test.com' }, { email: 'pan@test.com' }],
      });
    });

    test('returns 401 for an unknown user', async () => {
      jest.spyOn(User, 'findOne').mockResolvedValue(null);
      const res = mockRes();
      controller.login({ body: { identifier: 'ghost', password: 'secret123' } }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid credentials' });
    });

    test('returns 401 for a wrong password', async () => {
      jest.spyOn(User, 'findOne').mockResolvedValue({
        _id: 'id1',
        username: 'pan',
        authenticate: () => false,
      });
      const res = mockRes();
      controller.login({ body: { identifier: 'pan', password: 'wrong-pass' } }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('unknown user and wrong password produce identical responses (no user enumeration)', async () => {
      const resUnknown = mockRes();
      jest.spyOn(User, 'findOne').mockResolvedValue(null);
      controller.login({ body: { identifier: 'ghost', password: 'x'.repeat(8) } }, resUnknown);
      await flush();

      const resWrongPass = mockRes();
      jest.spyOn(User, 'findOne').mockResolvedValue({
        _id: 'id1', username: 'pan', authenticate: () => false,
      });
      controller.login({ body: { identifier: 'pan', password: 'x'.repeat(8) } }, resWrongPass);
      await flush();

      expect(resUnknown.json.mock.calls[0][0]).toEqual(resWrongPass.json.mock.calls[0][0]);
      expect(resUnknown.status.mock.calls[0][0]).toBe(resWrongPass.status.mock.calls[0][0]);
    });

    test('returns a token and the user on success', async () => {
      const user = { _id: 'id1', username: 'pan', authenticate: () => true };
      jest.spyOn(User, 'findOne').mockResolvedValue(user);
      const res = mockRes();
      controller.login({ body: { identifier: 'pan', password: 'secret123' } }, res);
      await flush();
      const body = res.json.mock.calls[0][0];
      expect(body.user).toEqual({ ...user, avatarUrl: null });
      expect(body.token.split('.')).toHaveLength(3);
      expect(res.status).not.toHaveBeenCalledWith(401);
    });

    test('returns 500 when the DB lookup fails', async () => {
      jest.spyOn(User, 'findOne').mockRejectedValue(new Error('db down'));
      const res = mockRes();
      controller.login({ body: { identifier: 'pan', password: 'secret123' } }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Login failed' });
    });
  });

  describe('me', () => {
    test('returns the authenticated user from req.user', () => {
      const res = mockRes();
      const user = { _id: 'id1', username: 'pan' };
      controller.me({ user }, res);
      expect(res.json).toHaveBeenCalledWith({ user: { ...user, avatarUrl: null } });
    });

    test('includes a signed avatarUrl when the user has an avatar', () => {
      const res = mockRes();
      const user = { _id: 'id1', username: 'pan', avatarFilename: 'abc.jpg' };
      controller.me({ user }, res);
      const body = res.json.mock.calls[0][0];
      expect(body.user.avatarUrl).toMatch(/^\/uploads\/avatars\/id1\/abc\.jpg\?exp=\d+&sig=[0-9a-f]+$/);
      expect(body.user).not.toHaveProperty('avatarFilename');
    });
  });

  describe('profile', () => {
    test('returns the requested user', async () => {
      const user = { _id: 'id2', username: 'maria' };
      jest.spyOn(User, 'findOne').mockResolvedValue(user);
      const res = mockRes();
      controller.profile({ params: { username: 'maria' } }, res);
      await flush();
      expect(res.json).toHaveBeenCalledWith({ user: { ...user, avatarUrl: null } });
    });

    test('never exposes the user\'s email address — this route is looked up by username alone', async () => {
      const user = { _id: 'id2', username: 'maria', email: 'maria@test.com' };
      jest.spyOn(User, 'findOne').mockResolvedValue(user);
      const res = mockRes();
      controller.profile({ params: { username: 'maria' } }, res);
      await flush();
      const [{ user: returnedUser }] = res.json.mock.calls[0];
      expect(returnedUser).not.toHaveProperty('email');
      expect(returnedUser).toEqual({ _id: 'id2', username: 'maria', avatarUrl: null });
    });

    test('returns 404 for a missing user', async () => {
      jest.spyOn(User, 'findOne').mockResolvedValue(null);
      const res = mockRes();
      controller.profile({ params: { username: 'ghost' } }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
    });

    test('returns 500 when the DB lookup fails', async () => {
      jest.spyOn(User, 'findOne').mockRejectedValue(new Error('boom'));
      const res = mockRes();
      controller.profile({ params: { username: 'x' } }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('search', () => {
    const requester = { _id: 'id1', username: 'pan' };

    test.each([
      ['missing q', {}],
      ['empty q', { q: '' }],
      ['single-character q', { q: 'a' }],
      ['whitespace-only q', { q: '  ' }],
      ['non-string q (injection)', { q: { $gt: '' } }],
    ])('rejects %s with 400 before touching the DB', (_name, query) => {
      const find = jest.spyOn(User, 'find');
      const res = mockRes();
      controller.search({ query, user: requester }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(find).not.toHaveBeenCalled();
    });

    test('excludes the requester and returns only username fields', async () => {
      const find = jest.spyOn(User, 'find').mockReturnValue({
        limit: jest.fn().mockResolvedValue([{ _id: 'id2', username: 'maria' }]),
      });
      const res = mockRes();
      controller.search({ query: { q: 'mar' }, user: requester }, res);
      await flush();
      expect(find).toHaveBeenCalledWith(
        { username: { $regex: 'mar', $options: 'i' }, _id: { $ne: 'id1' } },
        'username'
      );
      expect(res.json).toHaveBeenCalledWith({ users: [{ _id: 'id2', username: 'maria' }] });
    });

    test('escapes regex metacharacters in the search term', async () => {
      const limit = jest.fn().mockResolvedValue([]);
      const find = jest.spyOn(User, 'find').mockReturnValue({ limit });
      controller.search({ query: { q: 'a.*b' }, user: requester }, mockRes());
      await flush();
      expect(find.mock.calls[0][0].username.$regex).toBe('a\\.\\*b');
    });

    test('caps results to 10', async () => {
      const limit = jest.fn().mockResolvedValue([]);
      jest.spyOn(User, 'find').mockReturnValue({ limit });
      controller.search({ query: { q: 'ma' }, user: requester }, mockRes());
      await flush();
      expect(limit).toHaveBeenCalledWith(10);
    });

    test('returns 500 when the query fails', async () => {
      jest.spyOn(User, 'find').mockReturnValue({ limit: jest.fn().mockRejectedValue(new Error('x')) });
      const res = mockRes();
      controller.search({ query: { q: 'ma' }, user: requester }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('updateMe', () => {
    const makeUser = (overrides = {}) => ({
      _id: 'id1',
      username: 'pan',
      email: 'pan@test.com',
      save: jest.fn().mockImplementation(function () {
        return Promise.resolve(this);
      }),
      ...overrides,
    });

    test('rejects a body with neither username nor email', () => {
      const user = makeUser();
      const res = mockRes();
      controller.updateMe({ body: {}, user }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(user.save).not.toHaveBeenCalled();
    });

    test.each([
      ['too short', 'ab'],
      ['too long', 'x'.repeat(31)],
      ['not a string (injection)', { $gt: '' }],
      ['whitespace-only', '   '],
      ['too short once trimmed', ' ab'],
    ])('rejects an invalid username: %s', (_name, username) => {
      const user = makeUser();
      const res = mockRes();
      controller.updateMe({ body: { username }, user }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(user.save).not.toHaveBeenCalled();
    });

    test('trims surrounding whitespace off a valid username before saving', async () => {
      const user = makeUser();
      const res = mockRes();
      controller.updateMe({ body: { username: '  newname  ' }, user }, res);
      await flush();
      expect(user.username).toBe('newname');
      expect(user.save).toHaveBeenCalled();
    });

    test('rejects an invalid email', () => {
      const user = makeUser();
      const res = mockRes();
      controller.updateMe({ body: { email: 'not-an-email' }, user }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(user.save).not.toHaveBeenCalled();
    });

    test('updates only the fields provided', async () => {
      const user = makeUser();
      const res = mockRes();
      controller.updateMe({ body: { username: 'newname' }, user }, res);
      await flush();
      expect(user.username).toBe('newname');
      expect(user.email).toBe('pan@test.com');
      expect(user.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ user: { ...user, avatarUrl: null } });
    });

    test('maps a duplicate-key save rejection to 400', async () => {
      const user = makeUser({
        save: jest.fn().mockRejectedValue({ code: 11000, keyValue: { username: 'taken' } }),
      });
      const res = mockRes();
      controller.updateMe({ body: { username: 'taken' }, user }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'username already exists' });
    });
  });

  describe('uploadAvatar', () => {
    const makeUser = (overrides = {}) => ({
      _id: 'id1',
      username: 'pan',
      avatarFilename: undefined,
      ...overrides,
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('rejects when no file was uploaded', () => {
      const user = makeUser();
      const res = mockRes();
      const findOneAndUpdate = jest.spyOn(User, 'findOneAndUpdate');
      controller.uploadAvatar({ user, file: undefined }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(findOneAndUpdate).not.toHaveBeenCalled();
    });

    test('atomically writes the new filename, conditioned on the previously-read one', async () => {
      const user = makeUser({ avatarFilename: 'old.jpg' });
      jest.spyOn(User, 'findOneAndUpdate').mockResolvedValue({ ...user, avatarFilename: 'new.jpg' });
      controller.uploadAvatar({ user, file: { filename: 'new.jpg' } }, mockRes());
      await flush();
      expect(User.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'id1', avatarFilename: 'old.jpg' },
        { avatarFilename: 'new.jpg' },
        { new: true }
      );
    });

    test('a user with no prior avatar is matched via avatarFilename: null', async () => {
      const user = makeUser();
      jest.spyOn(User, 'findOneAndUpdate').mockResolvedValue({ ...user, avatarFilename: 'new.jpg' });
      controller.uploadAvatar({ user, file: { filename: 'new.jpg' } }, mockRes());
      await flush();
      expect(User.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'id1', avatarFilename: null },
        { avatarFilename: 'new.jpg' },
        { new: true }
      );
    });

    test('returns a signed avatarUrl on success', async () => {
      const user = makeUser();
      jest.spyOn(User, 'findOneAndUpdate').mockResolvedValue({ ...user, avatarFilename: 'new.jpg' });
      const res = mockRes();
      controller.uploadAvatar({ user, file: { filename: 'new.jpg' } }, res);
      await flush();
      const body = res.json.mock.calls[0][0];
      expect(body.user.avatarUrl).toMatch(/^\/uploads\/avatars\/id1\/new\.jpg\?/);
    });

    test('deletes the previous avatar file after a successful re-upload', async () => {
      const rm = jest.spyOn(fs, 'rm').mockImplementation((_path, _opts, cb) => cb(null));
      const user = makeUser({ avatarFilename: 'old.jpg' });
      jest.spyOn(User, 'findOneAndUpdate').mockResolvedValue({ ...user, avatarFilename: 'new.jpg' });
      controller.uploadAvatar({ user, file: { filename: 'new.jpg' } }, mockRes());
      await flush();
      expect(rm).toHaveBeenCalledWith(
        expect.stringContaining('old.jpg'),
        { force: true },
        expect.any(Function)
      );
    });

    test('409s and deletes the just-uploaded file when another request already changed the avatar', async () => {
      const rm = jest.spyOn(fs, 'rm').mockImplementation((_path, _opts, cb) => cb(null));
      const user = makeUser({ avatarFilename: 'old.jpg' });
      // A concurrent request already moved avatarFilename on — the
      // conditional update finds no matching document.
      jest.spyOn(User, 'findOneAndUpdate').mockResolvedValue(null);
      const res = mockRes();
      controller.uploadAvatar({ user, file: { filename: 'new.jpg' } }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(409);
      expect(rm).toHaveBeenCalledWith(
        expect.stringContaining('new.jpg'),
        { force: true },
        expect.any(Function)
      );
    });

    test('deletes the newly-uploaded file if the update fails', async () => {
      const rm = jest.spyOn(fs, 'rm').mockImplementation((_path, _opts, cb) => cb(null));
      const user = makeUser();
      jest.spyOn(User, 'findOneAndUpdate').mockRejectedValue(new Error('db down'));
      const res = mockRes();
      controller.uploadAvatar({ user, file: { filename: 'new.jpg' } }, res);
      await flush();
      expect(rm).toHaveBeenCalledWith(
        expect.stringContaining('new.jpg'),
        { force: true },
        expect.any(Function)
      );
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('removeAvatar', () => {
    const makeUser = (overrides = {}) => ({
      _id: 'id1',
      username: 'pan',
      avatarFilename: undefined,
      ...overrides,
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('is a no-op 200 when the user has no avatar', async () => {
      const user = makeUser();
      const res = mockRes();
      const findOneAndUpdate = jest.spyOn(User, 'findOneAndUpdate');
      controller.removeAvatar({ user }, res);
      await flush();
      expect(findOneAndUpdate).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ user: { ...user, avatarUrl: null } });
    });

    test('atomically clears the filename, conditioned on the previously-read one', async () => {
      const user = makeUser({ avatarFilename: 'old.jpg' });
      jest.spyOn(User, 'findOneAndUpdate').mockResolvedValue({ ...user, avatarFilename: null });
      controller.removeAvatar({ user }, mockRes());
      await flush();
      expect(User.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'id1', avatarFilename: 'old.jpg' },
        { avatarFilename: null },
        { new: true }
      );
    });

    test('deletes the file and returns a null avatarUrl on success', async () => {
      const rm = jest.spyOn(fs, 'rm').mockImplementation((_path, _opts, cb) => cb(null));
      const user = makeUser({ avatarFilename: 'old.jpg' });
      jest.spyOn(User, 'findOneAndUpdate').mockResolvedValue({ ...user, avatarFilename: null });
      const res = mockRes();
      controller.removeAvatar({ user }, res);
      await flush();
      expect(rm).toHaveBeenCalledWith(
        expect.stringContaining('old.jpg'),
        { force: true },
        expect.any(Function)
      );
      const body = res.json.mock.calls[0][0];
      expect(body.user.avatarUrl).toBeNull();
    });

    test('409s without touching disk when another request already changed the avatar', async () => {
      const rm = jest.spyOn(fs, 'rm').mockImplementation((_path, _opts, cb) => cb(null));
      const user = makeUser({ avatarFilename: 'old.jpg' });
      jest.spyOn(User, 'findOneAndUpdate').mockResolvedValue(null);
      const res = mockRes();
      controller.removeAvatar({ user }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(409);
      expect(rm).not.toHaveBeenCalled();
    });

    test('returns 500 when the update fails', async () => {
      const user = makeUser({ avatarFilename: 'old.jpg' });
      jest.spyOn(User, 'findOneAndUpdate').mockRejectedValue(new Error('db down'));
      const res = mockRes();
      controller.removeAvatar({ user }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
