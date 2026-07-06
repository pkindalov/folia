const Page = require('../../server/data/Page');

describe('Page model', () => {
  describe('schema validation (offline)', () => {
    test('requires album, filename, mimeType and size', () => {
      const err = new Page({}).validateSync();
      expect(err.errors.album).toBeDefined();
      expect(err.errors.filename).toBeDefined();
      expect(err.errors.mimeType).toBeDefined();
      expect(err.errors.size).toBeDefined();
    });

    test('rejects a negative size', () => {
      const err = new Page({
        album: '507f1f77bcf86cd799439011',
        filename: 'a.jpg',
        mimeType: 'image/jpeg',
        size: -1,
      }).validateSync();
      expect(err.errors.size).toBeDefined();
    });

    test('accepts a valid page', () => {
      const err = new Page({
        album: '507f1f77bcf86cd799439011',
        filename: 'a.jpg',
        mimeType: 'image/jpeg',
        size: 1024,
      }).validateSync();
      expect(err).toBeUndefined();
    });
  });

  describe('toJSON', () => {
    test('strips __v from serialized output', () => {
      const page = new Page({
        album: '507f1f77bcf86cd799439011',
        filename: 'a.jpg',
        mimeType: 'image/jpeg',
        size: 1024,
      });
      const json = page.toJSON();
      expect(json).not.toHaveProperty('__v');
      expect(json.filename).toBe('a.jpg');
    });
  });
});
