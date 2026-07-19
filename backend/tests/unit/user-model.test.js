const User = require('../../server/data/User');

describe('User model', () => {
  describe('toJSON', () => {
    test('strips salt, hashedPass and __v from serialized output', () => {
      const user = new User({
        username: 'pan',
        email: 'pan@test.com',
        salt: 'super-secret-salt',
        hashedPass: 'super-secret-hash',
        roles: ['User'],
      });
      const json = user.toJSON();
      expect(json).not.toHaveProperty('salt');
      expect(json).not.toHaveProperty('hashedPass');
      expect(json).not.toHaveProperty('__v');
      expect(json.username).toBe('pan');
      expect(json.email).toBe('pan@test.com');
      expect(json.roles).toEqual(['User']);
    });

    test('JSON.stringify never leaks password material', () => {
      const user = new User({
        username: 'pan',
        email: 'pan@test.com',
        salt: 'leak-me-salt',
        hashedPass: 'leak-me-hash',
      });
      const str = JSON.stringify({ user });
      expect(str).not.toContain('leak-me-salt');
      expect(str).not.toContain('leak-me-hash');
    });
  });

  describe('schema validation (offline)', () => {
    test('requires username and email', () => {
      const err = new User({}).validateSync();
      expect(err.errors.username).toBeDefined();
      expect(err.errors.email).toBeDefined();
    });

    test('rejects a username shorter than 3 chars', () => {
      const err = new User({ username: 'ab', email: 'a@b.com' }).validateSync();
      expect(err.errors.username.message).toMatch(/at least 3/);
    });

    test('trims and lowercases email', () => {
      const user = new User({ username: 'pan', email: '  PAN@Test.COM  ' });
      expect(user.email).toBe('pan@test.com');
    });

    test('trims username', () => {
      const user = new User({ username: '  pan  ', email: 'a@b.com' });
      expect(user.username).toBe('pan');
    });

    test('defaults tokenVersion to 0 for a new user', () => {
      const user = new User({ username: 'pan', email: 'a@b.com' });
      expect(user.tokenVersion).toBe(0);
    });
  });

  describe('authenticate', () => {
    const encryption = require('../../server/utilities/encryption');

    test('accepts the correct password and rejects a wrong one', () => {
      const salt = encryption.generateSalt();
      const user = new User({
        username: 'pan',
        email: 'a@b.com',
        salt,
        hashedPass: encryption.generateHashedPassword(salt, 'my-password-1'),
      });
      expect(user.authenticate('my-password-1')).toBe(true);
      expect(user.authenticate('my-password-2')).toBe(false);
    });
  });
});

describe('seedAdminUser', () => {
  const seedWithEnv = async (envVars) => {
    const calls = { create: null, warned: false };
    jest.isolateModules(() => {
      const saved = {};
      for (const [k, v] of Object.entries(envVars)) {
        saved[k] = process.env[k];
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }

      const FreshUser = require('../../server/data/User');
      jest.spyOn(FreshUser, 'findOne').mockResolvedValue(envVars.__existing ?? null);
      jest.spyOn(FreshUser, 'create').mockImplementation((doc) => {
        calls.create = doc;
        return Promise.resolve(doc);
      });
      jest.spyOn(console, 'warn').mockImplementation(() => {
        calls.warned = true;
      });

      FreshUser.seedAdminUser();

      for (const [k] of Object.entries(envVars)) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
      }
    });
    await new Promise(setImmediate);
    return calls;
  };

  test('skips seeding and warns when ADMIN_PASSWORD is not set', async () => {
    const calls = await seedWithEnv({ ADMIN_PASSWORD: undefined });
    expect(calls.create).toBeNull();
    expect(calls.warned).toBe(true);
  });

  test('skips seeding when the admin already exists', async () => {
    const calls = await seedWithEnv({
      ADMIN_PASSWORD: 'strong-password-1',
      __existing: { username: 'Admin' },
    });
    expect(calls.create).toBeNull();
  });

  test('seeds an admin with hashed password from env', async () => {
    const calls = await seedWithEnv({ ADMIN_PASSWORD: 'strong-password-1' });
    expect(calls.create).not.toBeNull();
    expect(calls.create.username).toBe('Admin');
    expect(calls.create.email).toBe('admin@folia.local');
    expect(calls.create.roles).toEqual(['Admin']);
    expect(calls.create.hashedPass).toMatch(/^[0-9a-f]{128}$/);
    expect(calls.create.hashedPass).not.toBe('strong-password-1');
    expect(calls.create).not.toHaveProperty('password');
  });

  test('respects ADMIN_USERNAME and ADMIN_EMAIL overrides', async () => {
    const calls = await seedWithEnv({
      ADMIN_PASSWORD: 'strong-password-1',
      ADMIN_USERNAME: 'root',
      ADMIN_EMAIL: 'root@folia.app',
    });
    expect(calls.create.username).toBe('root');
    expect(calls.create.email).toBe('root@folia.app');
  });
});
