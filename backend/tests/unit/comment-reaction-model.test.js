const CommentReaction = require('../../server/data/CommentReaction');
const Reaction = require('../../server/data/Reaction');

describe('CommentReaction model', () => {
  describe('schema validation (offline)', () => {
    test('requires comment, page, album, user and type', () => {
      const err = new CommentReaction({}).validateSync();
      expect(err.errors.comment).toBeDefined();
      expect(err.errors.page).toBeDefined();
      expect(err.errors.album).toBeDefined();
      expect(err.errors.user).toBeDefined();
      expect(err.errors.type).toBeDefined();
    });

    test.each(Reaction.REACTION_TYPES)('accepts a valid %s reaction', (type) => {
      const reaction = new CommentReaction({
        comment: '507f191e810c19729de860ed',
        page: '507f191e810c19729de860eb',
        album: '507f191e810c19729de860ea',
        user: '507f1f77bcf86cd799439011',
        type,
      });
      expect(reaction.validateSync()).toBeUndefined();
    });

    test('rejects a type outside the enum', () => {
      const err = new CommentReaction({
        comment: '507f191e810c19729de860ed',
        page: '507f191e810c19729de860eb',
        album: '507f191e810c19729de860ea',
        user: '507f1f77bcf86cd799439011',
        type: 'shrug',
      }).validateSync();
      expect(err.errors.type).toBeDefined();
    });
  });

  describe('toJSON', () => {
    test('strips __v from serialized output', () => {
      const reaction = new CommentReaction({
        comment: '507f191e810c19729de860ed',
        page: '507f191e810c19729de860eb',
        album: '507f191e810c19729de860ea',
        user: '507f1f77bcf86cd799439011',
        type: 'like',
      });
      const json = reaction.toJSON();
      expect(json).not.toHaveProperty('__v');
      expect(json.type).toBe('like');
    });
  });
});
