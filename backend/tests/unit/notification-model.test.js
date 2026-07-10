const Notification = require('../../server/data/Notification');

const RECIPIENT_ID = '507f1f77bcf86cd799439011';
const OTHER_RECIPIENT_ID = '507f1f77bcf86cd799439099';
const CIRCLE_ID = '507f191e810c19729de860ea';

describe('Notification model', () => {
  describe('schema validation (offline)', () => {
    test('requires recipient, type, circle, circleName and actorUsername', () => {
      const err = new Notification({}).validateSync();
      expect(err.errors.recipient).toBeDefined();
      expect(err.errors.type).toBeDefined();
      expect(err.errors.circle).toBeDefined();
      expect(err.errors.circleName).toBeDefined();
      expect(err.errors.actorUsername).toBeDefined();
    });

    test('accepts a valid circle_invite notification', () => {
      const notification = new Notification({
        recipient: RECIPIENT_ID,
        type: 'circle_invite',
        circle: CIRCLE_ID,
        circleName: 'The Sterling Family',
        actorUsername: 'pan',
      });
      expect(notification.validateSync()).toBeUndefined();
      expect(notification.read).toBe(false);
    });

    test.each([
      'circle_invite_accepted',
      'circle_invite_declined',
      'circle_deleted',
      'album_shared',
      'album_updated',
      'album_deleted',
      'album_photos_added',
      'album_photo_removed',
      'album_photo_caption_updated',
    ])('accepts a valid %s notification', (type) => {
      const notification = new Notification({
        recipient: RECIPIENT_ID,
        type,
        circle: CIRCLE_ID,
        circleName: 'The Sterling Family',
        actorUsername: 'sam',
      });
      expect(notification.validateSync()).toBeUndefined();
    });

    test('accepts and stores an album/albumTitle snapshot on an album_* notification', () => {
      const notification = new Notification({
        recipient: RECIPIENT_ID,
        type: 'album_shared',
        circle: CIRCLE_ID,
        circleName: 'The Sterling Family',
        actorUsername: 'sam',
        album: '507f191e810c19729de860eb',
        albumTitle: 'Summer Trip',
      });
      expect(notification.validateSync()).toBeUndefined();
      expect(notification.album.toString()).toBe('507f191e810c19729de860eb');
      expect(notification.albumTitle).toBe('Summer Trip');
    });

    test('album and albumTitle are optional — a circle_deleted notification has neither', () => {
      const notification = new Notification({
        recipient: RECIPIENT_ID,
        type: 'circle_deleted',
        circle: CIRCLE_ID,
        circleName: 'The Sterling Family',
        actorUsername: 'sam',
      });
      expect(notification.validateSync()).toBeUndefined();
      expect(notification.album).toBeUndefined();
      expect(notification.albumTitle).toBeUndefined();
    });

    test('rejects a type outside the enum', () => {
      const err = new Notification({
        recipient: RECIPIENT_ID,
        type: 'something_else',
        circle: CIRCLE_ID,
        circleName: 'The Sterling Family',
        actorUsername: 'pan',
      }).validateSync();
      expect(err.errors.type).toBeDefined();
    });
  });

  describe('toJSON', () => {
    test('strips __v from serialized output', () => {
      const notification = new Notification({
        recipient: RECIPIENT_ID,
        type: 'circle_invite',
        circle: CIRCLE_ID,
        circleName: 'The Sterling Family',
        actorUsername: 'pan',
      });
      const json = notification.toJSON();
      expect(json).not.toHaveProperty('__v');
      expect(json.circleName).toBe('The Sterling Family');
    });
  });

  describe('pruneExcessForRecipient', () => {
    function mockFindQuery(docs) {
      const query = {};
      query.sort = jest.fn().mockReturnValue(query);
      query.limit = jest.fn().mockResolvedValue(docs);
      return query;
    }

    test('does nothing when the recipient is under the cap', async () => {
      jest.spyOn(Notification, 'countDocuments').mockResolvedValue(50);
      const find = jest.spyOn(Notification, 'find');
      const deleteMany = jest.spyOn(Notification, 'deleteMany');

      await Notification.pruneExcessForRecipient(RECIPIENT_ID);

      expect(find).not.toHaveBeenCalled();
      expect(deleteMany).not.toHaveBeenCalled();
    });

    test('deletes only the oldest excess beyond the cap', async () => {
      jest.spyOn(Notification, 'countDocuments').mockResolvedValue(203);
      const oldestThree = [{ _id: 'a' }, { _id: 'b' }, { _id: 'c' }];
      const find = jest.spyOn(Notification, 'find').mockReturnValue(mockFindQuery(oldestThree));
      const deleteMany = jest.spyOn(Notification, 'deleteMany').mockResolvedValue({});

      await Notification.pruneExcessForRecipient(RECIPIENT_ID);

      expect(find).toHaveBeenCalledWith({ recipient: RECIPIENT_ID }, '_id');
      expect(deleteMany).toHaveBeenCalledWith({ _id: { $in: ['a', 'b', 'c'] } });
    });

    test('prunes already-read notifications before unread ones, oldest first within each group', async () => {
      jest.spyOn(Notification, 'countDocuments').mockResolvedValue(203);
      const query = mockFindQuery([{ _id: 'a' }, { _id: 'b' }, { _id: 'c' }]);
      jest.spyOn(Notification, 'find').mockReturnValue(query);
      jest.spyOn(Notification, 'deleteMany').mockResolvedValue({});

      await Notification.pruneExcessForRecipient(RECIPIENT_ID);

      expect(query.sort).toHaveBeenCalledWith({ read: -1, createdAt: 1 });
    });

    test("scopes the count and prune to the given recipient, not other recipients' notifications", async () => {
      const countDocuments = jest.spyOn(Notification, 'countDocuments').mockResolvedValue(1);

      await Notification.pruneExcessForRecipient(OTHER_RECIPIENT_ID);

      expect(countDocuments).toHaveBeenCalledWith({ recipient: OTHER_RECIPIENT_ID });
    });
  });
});
