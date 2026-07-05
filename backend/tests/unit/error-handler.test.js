const { handleMongooseError } = require('../../server/utilities/error-handler');

describe('handleMongooseError', () => {
  test('maps duplicate key error (11000) to "<field> already exists"', () => {
    const err = { code: 11000, keyValue: { username: 'pan' } };
    expect(handleMongooseError(err)).toBe('username already exists');
  });

  test('maps duplicate email key', () => {
    const err = { code: 11000, keyValue: { email: 'a@b.com' } };
    expect(handleMongooseError(err)).toBe('email already exists');
  });

  test('handles duplicate key error with missing keyValue', () => {
    expect(handleMongooseError({ code: 11000 })).toBe('field already exists');
  });

  test('handles duplicate key error with empty keyValue', () => {
    expect(handleMongooseError({ code: 11000, keyValue: {} })).toBe('field already exists');
  });

  test('returns the first validation error message', () => {
    const err = {
      errors: {
        username: { message: 'username must be at least 3 characters' },
        email: { message: 'email is required' },
      },
    };
    expect(handleMongooseError(err)).toBe('username must be at least 3 characters');
  });

  test('falls back to generic message for unknown error shapes', () => {
    expect(handleMongooseError({})).toBe('Invalid data');
    expect(handleMongooseError({ code: 999 })).toBe('Invalid data');
    expect(handleMongooseError(new Error('boom'))).toBe('Invalid data');
  });
});
