const Notification = require('../../server/data/Notification');
const User = require('../../server/data/User');
const storage = require('../../server/utilities/storage');
const controller = require('../../server/controllers/notifications-controller');

const flush = () => new Promise(setImmediate);

const USER_ID = '507f1f77bcf86cd799439011';
const OTHER_USER_ID = '507f1f77bcf86cd799439022';
const NOTIFICATION_ID = '507f191e810c19729de860ea';
const ACTOR_ID = '507f1f77bcf86cd799439044';

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
