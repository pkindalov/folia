// Deterministic env for every test file, regardless of any local .env
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long!!';
process.env.JWT_EXPIRES_IN = '1h';
delete process.env.ADMIN_PASSWORD;
delete process.env.ADMIN_USERNAME;
delete process.env.ADMIN_EMAIL;
delete process.env.CORS_ORIGIN;
