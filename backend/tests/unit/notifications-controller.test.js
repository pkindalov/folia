const Notification = require('../../server/data/Notification');
const User = require('../../server/data/User');
const Album = require('../../server/data/Album');
const Page = require('../../server/data/Page');
const Circle = require('../../server/data/Circle');
const storage = require('../../server/utilities/storage');
const controller = require('../../server/controllers/notifications-controller');

const flush = () => new Promise(setImmediate);

const USER_ID = '507f1f77bcf86cd799439011';
const OTHER_USER_ID = '507f1f77bcf86cd799439022';
const NOTIFICATION_ID = '507f191e810c19729de860ea';
const ACTOR_ID = '507f1f77bcf86cd799439044';
const ALBUM_ID = '507f1f77bcf86cd799439055';
const OWNER_ID = '507f1f77bcf86cd799439066';
const PAGE_ID = '507f1f77bcf86cd799439077';

const user = { _id: USER_ID, username: 'pan', roles: ['User'] };

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const fakeNotification = (overrides = {}) => {
  const doc = {
    _id: NOTIFICATION_ID,
    recipient: USER_ID,
    type: 'circle_invite',
    circle: '507f1f77bcf86cd799439033',
    circleName: 'The Sterling Family',
    actorUsername: 'maria',
    actor: ACTOR_ID,
    read: false,
    ...overrides,
  };
  doc.toJSON = () => {
    const { toJSON, ...plain } = doc;
    return plain;
  };
  return doc;
};

function mockNotificationQuery(notifications) {
  const query = {};
  query.sort = jest.fn().mockReturnValue(query);
  query.skip = jest.fn().mockReturnValue(query);
  query.limit = jest.fn().mockResolvedValue(notifications);
  return query;
}

beforeEach(() => {
  jest.spyOn(User, 'find').mockResolvedValue([]);
});

describe('notifications-controller', () => {
  describe('list', () => {
    test("returns only the requester's notifications, paginated", async () => {
      const find = jest
        .spyOn(Notification, 'find')
        .mockReturnValue(mockNotificationQuery([fakeNotification()]));
      jest.spyOn(Notification, 'countDocuments').mockResolvedValue(1);
      const res = mockRes();

      controller.list({ user, query: {} }, res);
      await flush();

      expect(find).toHaveBeenCalledWith({ recipient: USER_ID });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ total: 1, page: 1, limit: 20 })
      );
    });

    test('reports an empty list with total 0 when there are none', async () => {
      jest.spyOn(Notification, 'find').mockReturnValue(mockNotificationQuery([]));
      jest.spyOn(Notification, 'countDocuments').mockResolvedValue(0);
      const res = mockRes();

      controller.list({ user, query: {} }, res);
      await flush();

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ notifications: [], total: 0 })
      );
    });

    test('skips to the requested page', async () => {
      const query = mockNotificationQuery([]);
      jest.spyOn(Notification, 'find').mockReturnValue(query);
      jest.spyOn(Notification, 'countDocuments').mockResolvedValue(50);
      const res = mockRes();

      controller.list({ user, query: { page: '2' } }, res);
      await flush();

      expect(query.skip).toHaveBeenCalledWith(20);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));
    });

    test('returns 500 when the query fails', async () => {
      const query = mockNotificationQuery([]);
      query.limit = jest.fn().mockRejectedValue(new Error('x'));
      jest.spyOn(Notification, 'find').mockReturnValue(query);
      jest.spyOn(Notification, 'countDocuments').mockResolvedValue(0);
      const res = mockRes();

      controller.list({ user, query: {} }, res);
      await flush();

      expect(res.status).toHaveBeenCalledWith(500);
    });

    test('attaches actorAvatarUrl from a batched User lookup, keyed by actor id', async () => {
      jest
        .spyOn(Notification, 'find')
        .mockReturnValue(mockNotificationQuery([fakeNotification({ actor: ACTOR_ID })]));
      jest.spyOn(Notification, 'countDocuments').mockResolvedValue(1);
      const find = jest
        .spyOn(User, 'find')
        .mockResolvedValue([{ _id: ACTOR_ID, avatarFilename: 'photo.jpg' }]);
      jest.spyOn(storage, 'avatarUrl').mockReturnValue('https://signed.example/photo.jpg');
      const res = mockRes();

      controller.list({ user, query: {} }, res);
      await flush();

      expect(find).toHaveBeenCalledWith({ _id: { $in: [ACTOR_ID] } }, 'avatarFilename');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          notifications: [
            expect.objectContaining({ actorAvatarUrl: 'https://signed.example/photo.jpg' }),
          ],
        })
      );
    });

    test('falls back to null actorAvatarUrl for a legacy notification with no actor', async () => {
      jest
        .spyOn(Notification, 'find')
        .mockReturnValue(mockNotificationQuery([fakeNotification({ actor: undefined })]));
      jest.spyOn(Notification, 'countDocuments').mockResolvedValue(1);
      const find = jest.spyOn(User, 'find');
      const res = mockRes();

      controller.list({ user, query: {} }, res);
      await flush();

      expect(find).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          notifications: [expect.objectContaining({ actorAvatarUrl: null })],
        })
      );
    });

    test('falls back to null actorAvatarUrl when the actor account no longer exists', async () => {
      jest
        .spyOn(Notification, 'find')
        .mockReturnValue(mockNotificationQuery([fakeNotification({ actor: ACTOR_ID })]));
      jest.spyOn(Notification, 'countDocuments').mockResolvedValue(1);
      jest.spyOn(User, 'find').mockResolvedValue([]);
      const res = mockRes();

      controller.list({ user, query: {} }, res);
      await flush();

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          notifications: [expect.objectContaining({ actorAvatarUrl: null })],
        })
      );
    });

    test('resolves thumbnailUrl to the album cover image for album_shared/album_updated notifications', async () => {
      jest
        .spyOn(Notification, 'find')
        .mockReturnValue(
          mockNotificationQuery([fakeNotification({ type: 'album_shared', album: ALBUM_ID })])
        );
      jest.spyOn(Notification, 'countDocuments').mockResolvedValue(1);
      const albumFind = jest
        .spyOn(Album, 'find')
        .mockResolvedValue([{ _id: ALBUM_ID, owner: OWNER_ID, coverPage: null }]);
      jest.spyOn(Page, 'aggregate').mockResolvedValue([{ _id: ALBUM_ID, filename: 'cover.jpg' }]);
      const photoUrl = jest
        .spyOn(storage, 'photoUrl')
        .mockReturnValue('https://signed.example/cover.jpg');
      const res = mockRes();

      controller.list({ user, query: {} }, res);
      await flush();

      expect(albumFind).toHaveBeenCalledWith({ _id: { $in: [ALBUM_ID] } });
      expect(photoUrl).toHaveBeenCalledWith(OWNER_ID, ALBUM_ID, 'cover.jpg');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          notifications: [
            expect.objectContaining({ thumbnailUrl: 'https://signed.example/cover.jpg' }),
          ],
        })
      );
    });

    test('resolves thumbnailUrl to the referenced photo for album_photos_added notifications', async () => {
      jest.spyOn(Notification, 'find').mockReturnValue(
        mockNotificationQuery([
          fakeNotification({ type: 'album_photos_added', album: ALBUM_ID, page: PAGE_ID }),
        ])
      );
      jest.spyOn(Notification, 'countDocuments').mockResolvedValue(1);
      jest.spyOn(Album, 'find').mockResolvedValue([{ _id: ALBUM_ID, owner: OWNER_ID }]);
      const pageFind = jest
        .spyOn(Page, 'find')
        .mockResolvedValue([{ _id: PAGE_ID, album: ALBUM_ID, filename: 'photo.jpg' }]);
      const photoUrl = jest
        .spyOn(storage, 'photoUrl')
        .mockReturnValue('https://signed.example/photo.jpg');
      const res = mockRes();

      controller.list({ user, query: {} }, res);
      await flush();

      expect(pageFind).toHaveBeenCalledWith({ _id: { $in: [PAGE_ID] } }, 'album filename');
      expect(photoUrl).toHaveBeenCalledWith(OWNER_ID, ALBUM_ID, 'photo.jpg');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          notifications: [
            expect.objectContaining({ thumbnailUrl: 'https://signed.example/photo.jpg' }),
          ],
        })
      );
    });

    test('falls back to null thumbnailUrl when the referenced album no longer exists', async () => {
      jest
        .spyOn(Notification, 'find')
        .mockReturnValue(
          mockNotificationQuery([fakeNotification({ type: 'album_updated', album: ALBUM_ID })])
        );
      jest.spyOn(Notification, 'countDocuments').mockResolvedValue(1);
      jest.spyOn(Album, 'find').mockResolvedValue([]);
      const res = mockRes();

      controller.list({ user, query: {} }, res);
      await flush();

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          notifications: [expect.objectContaining({ thumbnailUrl: null })],
        })
      );
    });

    test('falls back to null thumbnailUrl when the referenced page no longer exists', async () => {
      jest.spyOn(Notification, 'find').mockReturnValue(
        mockNotificationQuery([
          fakeNotification({ type: 'album_photos_added', album: ALBUM_ID, page: PAGE_ID }),
        ])
      );
      jest.spyOn(Notification, 'countDocuments').mockResolvedValue(1);
      jest.spyOn(Album, 'find').mockResolvedValue([{ _id: ALBUM_ID, owner: OWNER_ID }]);
      jest.spyOn(Page, 'find').mockResolvedValue([]);
      const res = mockRes();

      controller.list({ user, query: {} }, res);
      await flush();

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          notifications: [expect.objectContaining({ thumbnailUrl: null })],
        })
      );
    });

    test('falls back to null thumbnailUrl when the referenced page belongs to a different album', async () => {
      jest.spyOn(Notification, 'find').mockReturnValue(
        mockNotificationQuery([
          fakeNotification({ type: 'album_photos_added', album: ALBUM_ID, page: PAGE_ID }),
        ])
      );
      jest.spyOn(Notification, 'countDocuments').mockResolvedValue(1);
      jest.spyOn(Album, 'find').mockResolvedValue([{ _id: ALBUM_ID, owner: OWNER_ID }]);
      jest
        .spyOn(Page, 'find')
        .mockResolvedValue([{ _id: PAGE_ID, album: 'some-other-album-id', filename: 'photo.jpg' }]);
      const res = mockRes();

      controller.list({ user, query: {} }, res);
      await flush();

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          notifications: [expect.objectContaining({ thumbnailUrl: null })],
        })
      );
    });

    test('does not query Album/Page for a notification type with no thumbnail (e.g. circle_invite)', async () => {
      jest
        .spyOn(Notification, 'find')
        .mockReturnValue(mockNotificationQuery([fakeNotification({ type: 'circle_invite' })]));
      jest.spyOn(Notification, 'countDocuments').mockResolvedValue(1);
      const albumFind = jest.spyOn(Album, 'find');
      const pageFind = jest.spyOn(Page, 'find');
      const res = mockRes();

      controller.list({ user, query: {} }, res);
      await flush();

      expect(albumFind).not.toHaveBeenCalled();
      expect(pageFind).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          notifications: [expect.objectContaining({ thumbnailUrl: null })],
        })
      );
    });

    test('falls back to null thumbnailUrl when the requester no longer has access to the album (e.g. re-privated after the notification was created)', async () => {
      jest
        .spyOn(Notification, 'find')
        .mockReturnValue(
          mockNotificationQuery([fakeNotification({ type: 'album_shared', album: ALBUM_ID })])
        );
      jest.spyOn(Notification, 'countDocuments').mockResolvedValue(1);
      jest
        .spyOn(Album, 'find')
        .mockResolvedValue([{ _id: ALBUM_ID, owner: OWNER_ID, visibility: 'private', coverPage: null }]);
      const res = mockRes();

      controller.list({ user, query: {} }, res);
      await flush();

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          notifications: [expect.objectContaining({ thumbnailUrl: null })],
        })
      );
    });

    test('resolves thumbnailUrl when the requester is still an accepted member of the circle the album is shared with', async () => {
      jest
        .spyOn(Notification, 'find')
        .mockReturnValue(
          mockNotificationQuery([fakeNotification({ type: 'album_shared', album: ALBUM_ID })])
        );
      jest.spyOn(Notification, 'countDocuments').mockResolvedValue(1);
      jest.spyOn(Album, 'find').mockResolvedValue([
        {
          _id: ALBUM_ID,
          owner: OWNER_ID,
          visibility: 'shared',
          sharedWithCircle: 'circle-1',
          coverPage: null,
        },
      ]);
      jest
        .spyOn(Circle, 'find')
        .mockResolvedValue([{ _id: 'circle-1', isOwnerOrMember: () => true }]);
      jest.spyOn(Page, 'aggregate').mockResolvedValue([{ _id: ALBUM_ID, filename: 'cover.jpg' }]);
      jest.spyOn(storage, 'photoUrl').mockReturnValue('https://signed.example/cover.jpg');
      const res = mockRes();

      controller.list({ user, query: {} }, res);
      await flush();

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          notifications: [
            expect.objectContaining({ thumbnailUrl: 'https://signed.example/cover.jpg' }),
          ],
        })
      );
    });

    test('falls back to null thumbnailUrl once removed from the circle the album is shared with', async () => {
      jest
        .spyOn(Notification, 'find')
        .mockReturnValue(
          mockNotificationQuery([fakeNotification({ type: 'album_photos_added', album: ALBUM_ID, page: PAGE_ID })])
        );
      jest.spyOn(Notification, 'countDocuments').mockResolvedValue(1);
      jest.spyOn(Album, 'find').mockResolvedValue([
        {
          _id: ALBUM_ID,
          owner: OWNER_ID,
          visibility: 'shared',
          sharedWithCircle: 'circle-1',
          coverPage: null,
        },
      ]);
      jest
        .spyOn(Circle, 'find')
        .mockResolvedValue([{ _id: 'circle-1', isOwnerOrMember: () => false }]);
      jest.spyOn(Page, 'find').mockResolvedValue([{ _id: PAGE_ID, album: ALBUM_ID, filename: 'photo.jpg' }]);
      const res = mockRes();

      controller.list({ user, query: {} }, res);
      await flush();

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          notifications: [expect.objectContaining({ thumbnailUrl: null })],
        })
      );
    });

    test('resolves both a cover thumbnail and a page thumbnail correctly when both types share one response', async () => {
      const OTHER_ALBUM_ID = '507f1f77bcf86cd799439088';
      jest.spyOn(Notification, 'find').mockReturnValue(
        mockNotificationQuery([
          fakeNotification({ _id: 'n1', type: 'album_shared', album: ALBUM_ID }),
          fakeNotification({
            _id: 'n2',
            type: 'album_photos_added',
            album: OTHER_ALBUM_ID,
            page: PAGE_ID,
          }),
        ])
      );
      jest.spyOn(Notification, 'countDocuments').mockResolvedValue(2);
      const albumFind = jest.spyOn(Album, 'find').mockResolvedValue([
        { _id: ALBUM_ID, owner: OWNER_ID, coverPage: null },
        { _id: OTHER_ALBUM_ID, owner: OWNER_ID, coverPage: null },
      ]);
      jest
        .spyOn(Page, 'aggregate')
        .mockResolvedValue([{ _id: ALBUM_ID, filename: 'cover.jpg' }]);
      jest
        .spyOn(Page, 'find')
        .mockResolvedValue([{ _id: PAGE_ID, album: OTHER_ALBUM_ID, filename: 'photo.jpg' }]);
      jest
        .spyOn(storage, 'photoUrl')
        .mockImplementation((ownerId, albumId, filename) => `https://signed.example/${filename}`);
      const res = mockRes();

      controller.list({ user, query: {} }, res);
      await flush();

      expect(albumFind).toHaveBeenCalledWith({ _id: { $in: [ALBUM_ID, OTHER_ALBUM_ID] } });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          notifications: [
            expect.objectContaining({ _id: 'n1', thumbnailUrl: 'https://signed.example/cover.jpg' }),
            expect.objectContaining({ _id: 'n2', thumbnailUrl: 'https://signed.example/photo.jpg' }),
          ],
        })
      );
    });
  });

  describe('unreadCount', () => {
    test('returns the count of unread notifications for the requester', async () => {
      const countDocuments = jest.spyOn(Notification, 'countDocuments').mockResolvedValue(4);
      const res = mockRes();

      controller.unreadCount({ user }, res);
      await flush();

      expect(countDocuments).toHaveBeenCalledWith({ recipient: USER_ID, read: false });
      expect(res.json).toHaveBeenCalledWith({ count: 4 });
    });

    test('returns 500 when the query fails', async () => {
      jest.spyOn(Notification, 'countDocuments').mockRejectedValue(new Error('x'));
      const res = mockRes();

      controller.unreadCount({ user }, res);
      await flush();

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('markRead', () => {
    test('404 for a malformed id, without touching the DB', () => {
      const findOneAndUpdate = jest.spyOn(Notification, 'findOneAndUpdate');
      const res = mockRes();

      controller.markRead({ params: { id: 'not-an-id' }, user }, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(findOneAndUpdate).not.toHaveBeenCalled();
    });

    test("scopes the update to the requester's own notification", async () => {
      const findOneAndUpdate = jest
        .spyOn(Notification, 'findOneAndUpdate')
        .mockResolvedValue(fakeNotification({ read: true }));
      const res = mockRes();

      controller.markRead({ params: { id: NOTIFICATION_ID }, user }, res);
      await flush();

      expect(findOneAndUpdate).toHaveBeenCalledWith(
        { _id: NOTIFICATION_ID, recipient: USER_ID },
        { $set: { read: true, readAt: expect.any(Date) } },
        expect.objectContaining({ new: true })
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ notification: expect.objectContaining({ read: true }) })
      );
    });

    test("404 (not 403) when the notification belongs to someone else — doesn't leak existence", async () => {
      jest.spyOn(Notification, 'findOneAndUpdate').mockResolvedValue(null);
      const res = mockRes();

      controller.markRead(
        { params: { id: NOTIFICATION_ID }, user: { _id: OTHER_USER_ID } },
        res
      );
      await flush();

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('is idempotent on an already-read notification', async () => {
      jest
        .spyOn(Notification, 'findOneAndUpdate')
        .mockResolvedValue(fakeNotification({ read: true }));
      const res = mockRes();

      controller.markRead({ params: { id: NOTIFICATION_ID }, user }, res);
      await flush();

      expect(res.status).not.toHaveBeenCalledWith(400);
      expect(res.status).not.toHaveBeenCalledWith(404);
    });

    test('returns 500 when the update fails', async () => {
      jest.spyOn(Notification, 'findOneAndUpdate').mockRejectedValue(new Error('x'));
      const res = mockRes();

      controller.markRead({ params: { id: NOTIFICATION_ID }, user }, res);
      await flush();

      expect(res.status).toHaveBeenCalledWith(500);
    });

    test('response carries actorAvatarUrl', async () => {
      jest
        .spyOn(Notification, 'findOneAndUpdate')
        .mockResolvedValue(fakeNotification({ read: true, actor: ACTOR_ID }));
      jest
        .spyOn(User, 'find')
        .mockResolvedValue([{ _id: ACTOR_ID, avatarFilename: 'photo.jpg' }]);
      jest.spyOn(storage, 'avatarUrl').mockReturnValue('https://signed.example/photo.jpg');
      const res = mockRes();

      controller.markRead({ params: { id: NOTIFICATION_ID }, user }, res);
      await flush();

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          notification: expect.objectContaining({
            actorAvatarUrl: 'https://signed.example/photo.jpg',
          }),
        })
      );
    });

    test('response carries thumbnailUrl', async () => {
      jest.spyOn(Notification, 'findOneAndUpdate').mockResolvedValue(
        fakeNotification({ read: true, type: 'album_photos_added', album: ALBUM_ID, page: PAGE_ID })
      );
      jest.spyOn(Album, 'find').mockResolvedValue([{ _id: ALBUM_ID, owner: OWNER_ID }]);
      jest
        .spyOn(Page, 'find')
        .mockResolvedValue([{ _id: PAGE_ID, album: ALBUM_ID, filename: 'photo.jpg' }]);
      jest.spyOn(storage, 'photoUrl').mockReturnValue('https://signed.example/photo.jpg');
      const res = mockRes();

      controller.markRead({ params: { id: NOTIFICATION_ID }, user }, res);
      await flush();

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          notification: expect.objectContaining({
            thumbnailUrl: 'https://signed.example/photo.jpg',
          }),
        })
      );
    });
  });

  describe('markUnread', () => {
    test('404 for a malformed id, without touching the DB', () => {
      const findOneAndUpdate = jest.spyOn(Notification, 'findOneAndUpdate');
      const res = mockRes();

      controller.markUnread({ params: { id: 'not-an-id' }, user }, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(findOneAndUpdate).not.toHaveBeenCalled();
    });

    test("scopes the update to the requester's own notification and unsets readAt", async () => {
      const findOneAndUpdate = jest
        .spyOn(Notification, 'findOneAndUpdate')
        .mockResolvedValue(fakeNotification({ read: false, readAt: undefined }));
      const res = mockRes();

      controller.markUnread({ params: { id: NOTIFICATION_ID }, user }, res);
      await flush();

      expect(findOneAndUpdate).toHaveBeenCalledWith(
        { _id: NOTIFICATION_ID, recipient: USER_ID },
        { $set: { read: false }, $unset: { readAt: '' } },
        expect.objectContaining({ new: true })
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ notification: expect.objectContaining({ read: false }) })
      );
    });

    test("404 (not 403) when the notification belongs to someone else — doesn't leak existence", async () => {
      jest.spyOn(Notification, 'findOneAndUpdate').mockResolvedValue(null);
      const res = mockRes();

      controller.markUnread(
        { params: { id: NOTIFICATION_ID }, user: { _id: OTHER_USER_ID } },
        res
      );
      await flush();

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('returns 500 when the update fails', async () => {
      jest.spyOn(Notification, 'findOneAndUpdate').mockRejectedValue(new Error('x'));
      const res = mockRes();

      controller.markUnread({ params: { id: NOTIFICATION_ID }, user }, res);
      await flush();

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('markAllRead', () => {
    test("marks only the requester's unread notifications as read", async () => {
      const updateMany = jest
        .spyOn(Notification, 'updateMany')
        .mockResolvedValue({ modifiedCount: 3 });
      const res = mockRes();

      controller.markAllRead({ user }, res);
      await flush();

      expect(updateMany).toHaveBeenCalledWith(
        { recipient: USER_ID, read: false },
        { $set: { read: true, readAt: expect.any(Date) } }
      );
      expect(res.json).toHaveBeenCalledWith({ updated: true, count: 3 });
    });

    test('returns 500 when the update fails', async () => {
      jest.spyOn(Notification, 'updateMany').mockRejectedValue(new Error('x'));
      const res = mockRes();

      controller.markAllRead({ user }, res);
      await flush();

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('markAllUnread', () => {
    test("marks only the requester's read notifications as unread and unsets readAt", async () => {
      const updateMany = jest
        .spyOn(Notification, 'updateMany')
        .mockResolvedValue({ modifiedCount: 2 });
      const res = mockRes();

      controller.markAllUnread({ user }, res);
      await flush();

      expect(updateMany).toHaveBeenCalledWith(
        { recipient: USER_ID, read: true },
        { $set: { read: false }, $unset: { readAt: '' } }
      );
      expect(res.json).toHaveBeenCalledWith({ updated: true, count: 2 });
    });

    test('returns 500 when the update fails', async () => {
      jest.spyOn(Notification, 'updateMany').mockRejectedValue(new Error('x'));
      const res = mockRes();

      controller.markAllUnread({ user }, res);
      await flush();

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('dismiss', () => {
    test('404 for a malformed id, without touching the DB', () => {
      const findOneAndDelete = jest.spyOn(Notification, 'findOneAndDelete');
      const res = mockRes();

      controller.dismiss({ params: { id: 'not-an-id' }, user }, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(findOneAndDelete).not.toHaveBeenCalled();
    });

    test("scopes the delete to the requester's own notification", async () => {
      const findOneAndDelete = jest
        .spyOn(Notification, 'findOneAndDelete')
        .mockResolvedValue(fakeNotification());
      const res = mockRes();

      controller.dismiss({ params: { id: NOTIFICATION_ID }, user }, res);
      await flush();

      expect(findOneAndDelete).toHaveBeenCalledWith({
        _id: NOTIFICATION_ID,
        recipient: USER_ID,
      });
      expect(res.json).toHaveBeenCalledWith({ deleted: true });
    });

    test("404 (not 403) when the notification belongs to someone else — doesn't leak existence", async () => {
      jest.spyOn(Notification, 'findOneAndDelete').mockResolvedValue(null);
      const res = mockRes();

      controller.dismiss({ params: { id: NOTIFICATION_ID }, user: { _id: OTHER_USER_ID } }, res);
      await flush();

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('returns 500 when the delete fails', async () => {
      jest.spyOn(Notification, 'findOneAndDelete').mockRejectedValue(new Error('x'));
      const res = mockRes();

      controller.dismiss({ params: { id: NOTIFICATION_ID }, user }, res);
      await flush();

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('deleteAll', () => {
    test("deletes only the requester's notifications", async () => {
      const deleteMany = jest
        .spyOn(Notification, 'deleteMany')
        .mockResolvedValue({ deletedCount: 5 });
      const res = mockRes();

      controller.deleteAll({ user }, res);
      await flush();

      expect(deleteMany).toHaveBeenCalledWith({ recipient: USER_ID });
      expect(res.json).toHaveBeenCalledWith({ deleted: true, count: 5 });
    });

    test('returns 500 when the delete fails', async () => {
      jest.spyOn(Notification, 'deleteMany').mockRejectedValue(new Error('x'));
      const res = mockRes();

      controller.deleteAll({ user }, res);
      await flush();

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
