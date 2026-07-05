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
      expect(body.user).toBe(created);
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
      ['missing password', { username: 'pan' }],
      ['missing username', { password: 'secret123' }],
      ['object as username (injection)', { username: { $gt: '' }, password: 'x' }],
      ['object as password (injection)', { username: 'pan', password: { $gt: '' } }],
      ['null body', null],
    ])('rejects %s with 400 before touching the DB', (_name, body) => {
      const findOne = jest.spyOn(User, 'findOne');
      const res = mockRes();
      controller.login({ body }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(findOne).not.toHaveBeenCalled();
    });

    test('queries by the exact username string', async () => {
      const findOne = jest.spyOn(User, 'findOne').mockResolvedValue(null);
      controller.login({ body: { username: 'pan', password: 'secret123' } }, mockRes());
      await flush();
      expect(findOne).toHaveBeenCalledWith({ username: 'pan' });
    });

    test('returns 401 for an unknown user', async () => {
      jest.spyOn(User, 'findOne').mockResolvedValue(null);
      const res = mockRes();
      controller.login({ body: { username: 'ghost', password: 'secret123' } }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid username or password' });
    });

    test('returns 401 for a wrong password', async () => {
      jest.spyOn(User, 'findOne').mockResolvedValue({
        _id: 'id1',
        username: 'pan',
        authenticate: () => false,
      });
      const res = mockRes();
      controller.login({ body: { username: 'pan', password: 'wrong-pass' } }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('unknown user and wrong password produce identical responses (no user enumeration)', async () => {
      const resUnknown = mockRes();
      jest.spyOn(User, 'findOne').mockResolvedValue(null);
      controller.login({ body: { username: 'ghost', password: 'x'.repeat(8) } }, resUnknown);
      await flush();

      const resWrongPass = mockRes();
      jest.spyOn(User, 'findOne').mockResolvedValue({
        _id: 'id1', username: 'pan', authenticate: () => false,
      });
      controller.login({ body: { username: 'pan', password: 'x'.repeat(8) } }, resWrongPass);
      await flush();

      expect(resUnknown.json.mock.calls[0][0]).toEqual(resWrongPass.json.mock.calls[0][0]);
      expect(resUnknown.status.mock.calls[0][0]).toBe(resWrongPass.status.mock.calls[0][0]);
    });

    test('returns a token and the user on success', async () => {
      const user = { _id: 'id1', username: 'pan', authenticate: () => true };
      jest.spyOn(User, 'findOne').mockResolvedValue(user);
      const res = mockRes();
      controller.login({ body: { username: 'pan', password: 'secret123' } }, res);
      await flush();
      const body = res.json.mock.calls[0][0];
      expect(body.user).toBe(user);
      expect(body.token.split('.')).toHaveLength(3);
      expect(res.status).not.toHaveBeenCalledWith(401);
    });

    test('returns 500 when the DB lookup fails', async () => {
      jest.spyOn(User, 'findOne').mockRejectedValue(new Error('db down'));
      const res = mockRes();
      controller.login({ body: { username: 'pan', password: 'secret123' } }, res);
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
      expect(res.json).toHaveBeenCalledWith({ user });
    });
  });

  describe('profile', () => {
    test('returns the requested user', async () => {
      const user = { _id: 'id2', username: 'maria' };
      jest.spyOn(User, 'findOne').mockResolvedValue(user);
      const res = mockRes();
      controller.profile({ params: { username: 'maria' } }, res);
      await flush();
      expect(res.json).toHaveBeenCalledWith({ user });
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
});
