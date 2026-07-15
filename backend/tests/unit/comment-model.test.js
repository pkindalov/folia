const Comment = require('../../server/data/Comment');

describe('Comment model', () => {
  describe('schema validation (offline)', () => {
    test('requires page, album, user and text', () => {
      const err = new Comment({}).validateSync();
      expect(err.errors.page).toBeDefined();
      expect(err.errors.album).toBeDefined();
      expect(err.errors.user).toBeDefined();
      expect(err.errors.text).toBeDefined();
    });

    test('accepts a valid comment', () => {
      const comment = new Comment({
        page: '507f191e810c19729de860eb',
        album: '507f191e810c19729de860ea',
        user: '507f1f77bcf86cd799439011',
        text: 'What a lovely photo!',
      });
      expect(comment.validateSync()).toBeUndefined();
    });

    test('trims the text', () => {
      const comment = new Comment({
        page: '507f191e810c19729de860eb',
        album: '507f191e810c19729de860ea',
        user: '507f1f77bcf86cd799439011',
        text: '  What a lovely photo!  ',
      });
      expect(comment.text).toBe('What a lovely photo!');
    });

    test('rejects text over the max length', () => {
      const err = new Comment({
        page: '507f191e810c19729de860eb',
        album: '507f191e810c19729de860ea',
        user: '507f1f77bcf86cd799439011',
        text: 'x'.repeat(Comment.MAX_COMMENT_LENGTH + 1),
      }).validateSync();
      expect(err.errors.text).toBeDefined();
    });

    test('accepts text at exactly the max length', () => {
      const comment = new Comment({
        page: '507f191e810c19729de860eb',
        album: '507f191e810c19729de860ea',
        user: '507f1f77bcf86cd799439011',
        text: 'x'.repeat(Comment.MAX_COMMENT_LENGTH),
      });
      expect(comment.validateSync()).toBeUndefined();
    });
  });

  describe('toJSON', () => {
    test('strips __v from serialized output', () => {
      const comment = new Comment({
        page: '507f191e810c19729de860eb',
        album: '507f191e810c19729de860ea',
        user: '507f1f77bcf86cd799439011',
        text: 'Great shot',
      });
      const json = comment.toJSON();
      expect(json).not.toHaveProperty('__v');
      expect(json.text).toBe('Great shot');
    });
  });
});
