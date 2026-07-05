const encryption = require('../../server/utilities/encryption');

describe('encryption utility', () => {
  describe('generateSalt', () => {
    test('returns a non-empty base64 string', () => {
      const salt = encryption.generateSalt();
      expect(typeof salt).toBe('string');
      expect(salt.length).toBeGreaterThan(0);
      expect(() => Buffer.from(salt, 'base64')).not.toThrow();
    });

    test('encodes 32 bytes of entropy (44 base64 chars)', () => {
      expect(encryption.generateSalt()).toHaveLength(44);
    });

    test('never generates the same salt twice (50 samples)', () => {
      const salts = new Set(Array.from({ length: 50 }, () => encryption.generateSalt()));
      expect(salts.size).toBe(50);
    });
  });

  describe('generateHashedPassword', () => {
    const salt = 'fixed-salt';

    test('is deterministic for the same salt + password', () => {
      expect(encryption.generateHashedPassword(salt, 'secret123')).toBe(
        encryption.generateHashedPassword(salt, 'secret123')
      );
    });

    test('produces a 64-byte hash as 128 hex chars', () => {
      const hash = encryption.generateHashedPassword(salt, 'secret123');
      expect(hash).toMatch(/^[0-9a-f]{128}$/);
    });

    test('different passwords produce different hashes', () => {
      expect(encryption.generateHashedPassword(salt, 'password-a')).not.toBe(
        encryption.generateHashedPassword(salt, 'password-b')
      );
    });

    test('different salts produce different hashes for the same password', () => {
      expect(encryption.generateHashedPassword('salt-1', 'secret123')).not.toBe(
        encryption.generateHashedPassword('salt-2', 'secret123')
      );
    });

    test('handles unicode passwords', () => {
      const hash = encryption.generateHashedPassword(salt, 'п@роla✓🔒');
      expect(hash).toMatch(/^[0-9a-f]{128}$/);
    });

    test('handles very long passwords (1000 chars)', () => {
      const hash = encryption.generateHashedPassword(salt, 'x'.repeat(1000));
      expect(hash).toMatch(/^[0-9a-f]{128}$/);
    });

    test('one-character password difference changes the entire hash', () => {
      const a = encryption.generateHashedPassword(salt, 'secret123');
      const b = encryption.generateHashedPassword(salt, 'secret124');
      expect(a).not.toBe(b);
    });
  });

  describe('verifyPassword', () => {
    const salt = encryption.generateSalt();
    const hash = encryption.generateHashedPassword(salt, 'correct-horse');

    test('returns true for the correct password', () => {
      expect(encryption.verifyPassword(salt, 'correct-horse', hash)).toBe(true);
    });

    test('returns false for a wrong password', () => {
      expect(encryption.verifyPassword(salt, 'wrong-horse', hash)).toBe(false);
    });

    test('returns false with the wrong salt', () => {
      expect(encryption.verifyPassword(encryption.generateSalt(), 'correct-horse', hash)).toBe(false);
    });

    test('returns false for an empty password attempt', () => {
      expect(encryption.verifyPassword(salt, '', hash)).toBe(false);
    });

    test('returns false for a truncated stored hash (length mismatch)', () => {
      expect(encryption.verifyPassword(salt, 'correct-horse', hash.slice(0, 64))).toBe(false);
    });

    test('returns false for an empty stored hash', () => {
      expect(encryption.verifyPassword(salt, 'correct-horse', '')).toBe(false);
    });

    test('returns false when one hex char of the hash is tampered', () => {
      const tampered = (hash[0] === 'a' ? 'b' : 'a') + hash.slice(1);
      expect(encryption.verifyPassword(salt, 'correct-horse', tampered)).toBe(false);
    });

    test('is case sensitive in passwords', () => {
      expect(encryption.verifyPassword(salt, 'Correct-horse', hash)).toBe(false);
    });

    test('does not trim whitespace from passwords', () => {
      expect(encryption.verifyPassword(salt, ' correct-horse', hash)).toBe(false);
      expect(encryption.verifyPassword(salt, 'correct-horse ', hash)).toBe(false);
    });
  });
});
