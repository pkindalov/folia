const AlbumReaction = require('../../server/data/AlbumReaction');

describe('AlbumReaction model', () => {
  describe('schema validation (offline)', () => {
    test('requires album and user', () => {
      const err = new AlbumReaction({}).validateSync();
      expect(err.errors.album).toBeDefined();
      expect(err.errors.user).toBeDefined();
    });

    test('accepts a valid album reaction', () => {
      const reaction = new AlbumReaction({
        album: '507f191e810c19729de860ea',
        user: '507f1f77bcf86cd799439011',
      });
      expect(reaction.validateSync()).toBeUndefined();
    });
  });

  describe('toJSON', () => {
    test('strips __v from serialized output', () => {
      const reaction = new AlbumReaction({
        album: '507f191e810c19729de860ea',
        user: '507f1f77bcf86cd799439011',
      });
      const json = reaction.toJSON();
      expect(json).not.toHaveProperty('__v');
      expect(json.album.toString()).toBe('507f191e810c19729de860ea');
    });
  });

  describe('indexes', () => {
    test('has a unique compound index on album and user', () => {
      const indexes = AlbumReaction.schema.indexes();
      const compoundIndex = indexes.find(
        ([fields]) => fields.album === 1 && fields.user === 1
      );
      expect(compoundIndex).toBeDefined();
      expect(compoundIndex[1].unique).toBe(true);
    });
  });
});
