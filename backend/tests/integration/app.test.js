const request = require('supertest');
const express = require('express');

const User = require('../../server/data/User');
const auth = require('../../server/config/auth');

function buildApp() {
  const app = express();
  require('../../server/config/express')(app);
  require('../../server/config/routes')(app);
  return app;
}

describe('HTTP integration', () => {
  let app;

  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    app = buildApp();
  });

  describe('GET /api/health', () => {
    test('responds with service status and db state', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('folia-backend');
      expect(['disconnected', 'connected', 'connecting', 'disconnecting']).toContain(res.body.db);
      expect(typeof res.body.uptime).toBe('number');
    });
  });

  describe('security headers', () => {
    test('does not expose x-powered-by', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    test('sets helmet headers (nosniff, CSP, frame protection)', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['content-security-policy']).toBeDefined();
      expect(res.headers['x-frame-options']).toBeDefined();
    });

    test('sends CORS headers', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['access-control-allow-origin']).toBe('*');
    });
  });

  describe('unknown routes', () => {
    test.each(['/nope', '/api', '/api/unknown', '/users'])(
      'GET %s responds 404 as JSON',
      async (path) => {
        const res = await request(app).get(path);
        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: 'Not found' });
      }
    );

    test('unknown methods on known paths are 404 too', async () => {
      const res = await request(app).delete('/api/health');
      expect(res.status).toBe(404);
    });
  });

  describe('body parsing edge cases', () => {
    test('malformed JSON body responds 400, not 500', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'application/json')
        .send('{"username": "pan", INVALID');
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Invalid JSON body' });
    });

    test('oversized body (>100kb) responds 413', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ username: 'x'.repeat(150 * 1024) }));
      expect(res.status).toBe(413);
      expect(res.body).toEqual({ error: 'Request body too large' });
    });

    test('empty body responds 400 with validation message', async () => {
      const res = await request(app).post('/api/auth/login').send();
      expect(res.status).toBe(400);
    });
  });

  describe('auth flow over HTTP (model mocked)', () => {
    test('login returns 200 with token, then /me works with that token', async () => {
      const fakeUser = {
        _id: '507f1f77bcf86cd799439011',
        username: 'pan',
        roles: ['User'],
        authenticate: () => true,
      };
      jest.spyOn(User, 'findOne').mockResolvedValue(fakeUser);
      jest.spyOn(User, 'findById').mockResolvedValue(fakeUser);

      const login = await request(app)
        .post('/api/auth/login')
        .send({ identifier: 'pan', password: 'secret123' });
      expect(login.status).toBe(200);
      expect(login.body.token).toBeDefined();

      const me = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${login.body.token}`);
      expect(me.status).toBe(200);
      expect(me.body.user.username).toBe('pan');
    });

    test('protected route without token responds 401', async () => {
      const res = await request(app).get('/api/users/me');
      expect(res.status).toBe(401);
    });

    test('protected route with garbage token responds 401', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', 'Bearer garbage.token.here');
      expect(res.status).toBe(401);
    });

    test('register rejects injection payload through the full stack', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: { $gt: '' }, email: 'a@b.com', password: 'secret123' });
      expect(res.status).toBe(400);
    });
  });

  // Keep last: exhausts the shared rate limiter for auth routes
  describe('rate limiting', () => {
    test('auth endpoints return 429 after the limit is exhausted', async () => {
      let last;
      for (let i = 0; i < 25; i++) {
        last = await request(app).post('/api/auth/login').send({ username: 'x' });
      }
      expect(last.status).toBe(429);
      expect(last.body).toEqual({ error: 'Too many attempts, try again later' });
    });

    test('rate-limited responses include standard RateLimit headers', async () => {
      const res = await request(app).post('/api/auth/login').send({ username: 'x' });
      expect(res.status).toBe(429);
      expect(res.headers['ratelimit-limit']).toBeDefined();
    });

    test('non-auth endpoints are not rate limited', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
    });
  });
});
