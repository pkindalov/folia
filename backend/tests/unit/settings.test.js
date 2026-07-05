// Mock dotenv so a developer's local .env can never influence these tests
jest.mock('dotenv', () => ({ config: jest.fn() }));

const ENV_KEYS = [
  'NODE_ENV', 'DB_URL', 'PORT', 'JWT_SECRET', 'JWT_EXPIRES_IN',
  'UPLOADS_DIR', 'CORS_ORIGIN', 'ADMIN_USERNAME', 'ADMIN_EMAIL', 'ADMIN_PASSWORD',
];

const loadSettings = () => {
  let settings;
  jest.isolateModules(() => {
    settings = require('../../server/config/settings');
  });
  return settings;
};

describe('settings', () => {
  let saved;

  beforeEach(() => {
    saved = {};
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  test('provides development, test and production configurations', () => {
    const settings = loadSettings();
    expect(settings).toHaveProperty('development');
    expect(settings).toHaveProperty('test');
    expect(settings).toHaveProperty('production');
  });

  test('applies safe defaults when env vars are missing', () => {
    const { development } = loadSettings();
    expect(development.db).toBe('mongodb://localhost:27017/folia');
    expect(development.port).toBe(1337);
    expect(development.jwtSecret).toBe('dev-only-secret');
    expect(development.jwtExpiresIn).toBe('7d');
    expect(development.corsOrigin).toBe('*');
    expect(development.admin.username).toBe('Admin');
    expect(development.admin.email).toBe('admin@folia.local');
    expect(development.admin.password).toBeUndefined();
  });

  test('env vars override every default', () => {
    process.env.DB_URL = 'mongodb://db:27017/x';
    process.env.PORT = '4000';
    process.env.JWT_SECRET = 's'.repeat(40);
    process.env.JWT_EXPIRES_IN = '1h';
    process.env.CORS_ORIGIN = 'https://folia.app';
    process.env.ADMIN_USERNAME = 'root';
    process.env.ADMIN_EMAIL = 'root@folia.app';
    process.env.ADMIN_PASSWORD = 'hunter22!';

    const { development } = loadSettings();
    expect(development.db).toBe('mongodb://db:27017/x');
    expect(development.port).toBe('4000');
    expect(development.jwtSecret).toBe('s'.repeat(40));
    expect(development.jwtExpiresIn).toBe('1h');
    expect(development.corsOrigin).toBe('https://folia.app');
    expect(development.admin).toEqual({
      username: 'root',
      email: 'root@folia.app',
      password: 'hunter22!',
    });
  });

  test('throws in production when JWT_SECRET is missing', () => {
    process.env.NODE_ENV = 'production';
    expect(loadSettings).toThrow(/JWT_SECRET/);
  });

  test('throws in production when JWT_SECRET is shorter than 32 chars', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'short-secret';
    expect(loadSettings).toThrow(/JWT_SECRET/);
  });

  test('accepts a 32+ char JWT_SECRET in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'x'.repeat(32);
    const { production } = loadSettings();
    expect(production.jwtSecret).toBe('x'.repeat(32));
  });

  test('does not enforce JWT_SECRET outside production', () => {
    process.env.NODE_ENV = 'development';
    expect(loadSettings).not.toThrow();
  });
});
