const jwt = require('jsonwebtoken');

const User = require('../../server/data/User'); // registers the mongoose model
const auth = require('../../server/config/auth');
const settings = require('../../server/config/settings')[process.env.NODE_ENV];

const flush = () => new Promise(setImmediate);

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('auth', () => {
  describe('signToken', () => {
    const user = { _id: '507f1f77bcf86cd799439011', username: 'pan' };

    test('embeds user id as sub and username in the payload', () => {
      const payload = jwt.verify(auth.signToken(user), settings.jwtSecret);
      expect(payload.sub).toBe('507f1f77bcf86cd799439011');
      expect(payload.username).toBe('pan');
    });

    test('sets an expiration', () => {
      const payload = jwt.verify(auth.signToken(user), settings.jwtSecret);
      expect(payload.exp).toBeGreaterThan(payload.iat);
    });

    test('embeds tokenVersion, defaulting to 0 when the user has none set', () => {
      const payload = jwt.verify(auth.signToken(user), settings.jwtSecret);
      expect(payload.tokenVersion).toBe(0);

      const payloadWithVersion = jwt.verify(
        auth.signToken({ ...user, tokenVersion: 3 }),
        settings.jwtSecret
      );
      expect(payloadWithVersion.tokenVersion).toBe(3);
    });

    test('token is rejected when signed with a different secret', () => {
      const forged = jwt.sign({ sub: 'x' }, 'attacker-secret');
      expect(() => jwt.verify(forged, settings.jwtSecret)).toThrow();
    });
  });

  describe('isAuthenticated', () => {
    const validToken = () => auth.signToken({ _id: 'abc123', username: 'pan' });

    test.each([
      ['no authorization header', {}],
      ['empty authorization header', { authorization: '' }],
      ['non-Bearer scheme', { authorization: 'Basic dXNlcjpwYXNz' }],
      ['Bearer with no token', { authorization: 'Bearer' }],
    ])('rejects request with %s (401)', async (_name, headers) => {
      const res = mockRes();
      const next = jest.fn();
      auth.isAuthenticated({ headers }, res, next);
      await flush();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    test('rejects a malformed token (401)', async () => {
      const res = mockRes();
      const next = jest.fn();
      auth.isAuthenticated({ headers: { authorization: 'Bearer not.a.jwt' } }, res, next);
      await flush();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    });

    test('rejects an expired token (401)', async () => {
      const expired = jwt.sign({ sub: 'abc' }, settings.jwtSecret, { expiresIn: '-1s' });
      const res = mockRes();
      const next = jest.fn();
      auth.isAuthenticated({ headers: { authorization: `Bearer ${expired}` } }, res, next);
      await flush();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('rejects a token signed with the wrong secret (401)', async () => {
      const forged = jwt.sign({ sub: 'abc' }, 'attacker-secret');
      const res = mockRes();
      const next = jest.fn();
      auth.isAuthenticated({ headers: { authorization: `Bearer ${forged}` } }, res, next);
      await flush();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('rejects when the user no longer exists (401)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(null);
      const res = mockRes();
      const next = jest.fn();
      auth.isAuthenticated({ headers: { authorization: `Bearer ${validToken()}` } }, res, next);
      await flush();
      expect(User.findById).toHaveBeenCalledWith('abc123');
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'User no longer exists' });
    });

    test('returns 500 when the user lookup fails', async () => {
      jest.spyOn(User, 'findById').mockRejectedValue(new Error('db down'));
      const res = mockRes();
      const next = jest.fn();
      auth.isAuthenticated({ headers: { authorization: `Bearer ${validToken()}` } }, res, next);
      await flush();
      expect(res.status).toHaveBeenCalledWith(500);
    });

    test('attaches req.user and calls next on success', async () => {
      const fakeUser = { _id: 'abc123', username: 'pan', roles: ['User'] };
      jest.spyOn(User, 'findById').mockResolvedValue(fakeUser);
      const req = { headers: { authorization: `Bearer ${validToken()}` } };
      const res = mockRes();
      const next = jest.fn();
      auth.isAuthenticated(req, res, next);
      await flush();
      expect(req.user).toBe(fakeUser);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    // A logout bumps tokenVersion (see users-controller.js's logout) — a
    // token signed before that point embeds the old value and must stop
    // working immediately, not linger until it naturally expires.
    test('rejects a token whose tokenVersion was revoked by a logout (401)', async () => {
      const token = auth.signToken({ _id: 'abc123', username: 'pan', tokenVersion: 0 });
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: 'abc123',
        username: 'pan',
        roles: ['User'],
        tokenVersion: 1,
      });
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = mockRes();
      const next = jest.fn();
      auth.isAuthenticated(req, res, next);
      await flush();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
      expect(next).not.toHaveBeenCalled();
    });

    test('accepts a token whose tokenVersion still matches the user record', async () => {
      const token = auth.signToken({ _id: 'abc123', username: 'pan', tokenVersion: 2 });
      const fakeUser = { _id: 'abc123', username: 'pan', roles: ['User'], tokenVersion: 2 };
      jest.spyOn(User, 'findById').mockResolvedValue(fakeUser);
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = mockRes();
      const next = jest.fn();
      auth.isAuthenticated(req, res, next);
      await flush();
      expect(req.user).toBe(fakeUser);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('isInRole', () => {
    test('allows a user that has the role', () => {
      const next = jest.fn();
      const res = mockRes();
      auth.isInRole('Admin')({ user: { roles: ['User', 'Admin'] } }, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('rejects a user without the role (403)', () => {
      const next = jest.fn();
      const res = mockRes();
      auth.isInRole('Admin')({ user: { roles: ['User'] } }, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    test('rejects when req.user is missing (403)', () => {
      const next = jest.fn();
      const res = mockRes();
      auth.isInRole('Admin')({}, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    test('role matching is exact (case sensitive)', () => {
      const next = jest.fn();
      const res = mockRes();
      auth.isInRole('Admin')({ user: { roles: ['admin'] } }, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });
});
