jest.mock('../../server/utilities/storage', () => ({
  removeUserDir: jest.fn(),
  removeAvatarDir: jest.fn(),
}));

const User = require('../../server/data/User');
const Album = require('../../server/data/Album');
const Page = require('../../server/data/Page');
const Reaction = require('../../server/data/Reaction');
const AlbumReaction = require('../../server/data/AlbumReaction');
const Comment = require('../../server/data/Comment');
const CommentReaction = require('../../server/data/CommentReaction');
const Circle = require('../../server/data/Circle');
const Notification = require('../../server/data/Notification');
const storage = require('../../server/utilities/storage');
const { deleteUser, planUserDeletion, UserNotFoundError } = require('../../server/utilities/user-deletion');

const USER_ID = '507f1f77bcf86cd799439011';
const ALBUM_ID = '507f191e810c19729de860ea';
const OTHER_ALBUM_ID = '507f191e810c19729de860eb';
const CIRCLE_ID = '507f1f77bcf86cd799439033';
const MEMBER_ID = '507f1f77bcf86cd799439044';

const flush = () => new Promise(setImmediate);

const fakeUser = (overrides = {}) => ({
  _id: USER_ID,
  username: 'zztestuser-123',
  email: 'zztestuser-123@example.invalid',
  roles: ['User'],
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  // clearAllMocks resets call history but not custom implementations set by
  // an earlier test — reassert the no-op default here so nothing leaks
  // across tests.
  storage.removeUserDir.mockImplementation(() => {});
  storage.removeAvatarDir.mockImplementation(() => {});
  jest.spyOn(Album, 'find').mockResolvedValue([]);
  jest.spyOn(Circle, 'find').mockResolvedValue([]);
  jest.spyOn(Album, 'updateMany').mockResolvedValue({});
  jest.spyOn(Circle, 'updateMany').mockResolvedValue({});
  jest.spyOn(Page, 'deleteMany').mockResolvedValue({});
  jest.spyOn(Reaction, 'deleteMany').mockResolvedValue({});
  jest.spyOn(AlbumReaction, 'deleteMany').mockResolvedValue({});
  jest.spyOn(Comment, 'find').mockResolvedValue([]);
  jest.spyOn(Comment, 'deleteMany').mockResolvedValue({});
  jest.spyOn(CommentReaction, 'deleteMany').mockResolvedValue({});
  jest.spyOn(Album, 'deleteMany').mockResolvedValue({});
  jest.spyOn(Circle, 'deleteMany').mockResolvedValue({});
  jest.spyOn(Notification, 'deleteMany').mockResolvedValue({});
  jest.spyOn(Notification, 'create').mockResolvedValue({ _id: 'notif1' });
  jest.spyOn(Notification, 'pruneExcessForRecipient').mockResolvedValue(null);
  jest.spyOn(Notification, 'updateMany').mockResolvedValue({ acknowledged: true, modifiedCount: 0 });
  jest.spyOn(User, 'deleteOne').mockResolvedValue({});
});

describe('planUserDeletion', () => {
  test('rejects with UserNotFoundError when the user does not exist', async () => {
    jest.spyOn(User, 'findById').mockResolvedValue(null);

    await expect(planUserDeletion(USER_ID)).rejects.toBeInstanceOf(UserNotFoundError);
  });

  test('reports the albums and circles the user owns', async () => {
    jest.spyOn(User, 'findById').mockResolvedValue(fakeUser());
    jest.spyOn(Album, 'find').mockResolvedValue([{ _id: ALBUM_ID, title: 'Summer' }]);
    jest.spyOn(Circle, 'find').mockResolvedValue([{ _id: CIRCLE_ID, name: 'Family' }]);

    const plan = await planUserDeletion(USER_ID);

    expect(plan.albumIds).toEqual([ALBUM_ID]);
    expect(plan.circleIds).toEqual([CIRCLE_ID]);
    expect(plan.user.username).toBe('zztestuser-123');
  });
});

describe('deleteUser', () => {
  test('rejects with UserNotFoundError when the user does not exist, without touching disk or the DB', async () => {
    jest.spyOn(User, 'findById').mockResolvedValue(null);

    await expect(deleteUser(USER_ID)).rejects.toBeInstanceOf(UserNotFoundError);
    expect(storage.removeUserDir).not.toHaveBeenCalled();
    expect(User.deleteOne).not.toHaveBeenCalled();
  });

  test('removes the upload and avatar folders before any database write', async () => {
    jest.spyOn(User, 'findById').mockResolvedValue(fakeUser());
    const callOrder = [];
    storage.removeUserDir.mockImplementation(() => callOrder.push('removeUserDir'));
    storage.removeAvatarDir.mockImplementation(() => callOrder.push('removeAvatarDir'));
    jest.spyOn(Album, 'deleteMany').mockImplementation(() => {
      callOrder.push('Album.deleteMany');
      return Promise.resolve({});
    });

    await deleteUser(USER_ID);

    expect(callOrder).toEqual(['removeUserDir', 'removeAvatarDir', 'Album.deleteMany']);
    expect(storage.removeUserDir).toHaveBeenCalledWith(USER_ID);
    expect(storage.removeAvatarDir).toHaveBeenCalledWith(USER_ID);
  });

  test('leaves the database completely untouched when removing the upload folder fails', async () => {
    jest.spyOn(User, 'findById').mockResolvedValue(fakeUser());
    storage.removeUserDir.mockImplementationOnce(() => {
      throw new Error('EBUSY: resource busy or locked');
    });

    await expect(deleteUser(USER_ID)).rejects.toThrow(/Failed to remove upload folders/);
    expect(Album.deleteMany).not.toHaveBeenCalled();
    expect(User.deleteOne).not.toHaveBeenCalled();
  });

  test('unshares albums pointing at a circle the user owns, before deleting the circle', async () => {
    jest.spyOn(User, 'findById').mockResolvedValue(fakeUser());
    jest.spyOn(Circle, 'find').mockResolvedValue([{ _id: CIRCLE_ID, name: 'Family', owner: USER_ID, members: [] }]);
    const updateMany = jest.spyOn(Album, 'updateMany');

    await deleteUser(USER_ID);

    expect(updateMany).toHaveBeenCalledWith(
      { sharedWithCircle: { $in: [CIRCLE_ID] } },
      { sharedWithCircle: null, visibility: 'private' }
    );
  });

  test('removes the user from every other circle they were a member of', async () => {
    jest.spyOn(User, 'findById').mockResolvedValue(fakeUser());
    const updateMany = jest.spyOn(Circle, 'updateMany');

    await deleteUser(USER_ID);

    expect(updateMany).toHaveBeenCalledWith(
      { 'members.user': USER_ID },
      { $pull: { members: { user: USER_ID } } }
    );
  });

  test('notifies accepted members that an owned circle is gone, and clears its invite notifications', async () => {
    jest.spyOn(User, 'findById').mockResolvedValue(fakeUser());
    jest.spyOn(Circle, 'find').mockResolvedValue([
      {
        _id: CIRCLE_ID,
        name: 'Family',
        owner: USER_ID,
        members: [{ user: MEMBER_ID, status: 'accepted' }],
      },
    ]);

    await deleteUser(USER_ID);
    await flush();

    expect(Notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: MEMBER_ID,
        type: 'circle_deleted',
        circle: CIRCLE_ID,
        circleName: 'Family',
        actorUsername: 'zztestuser-123',
        actor: USER_ID,
      })
    );
    expect(Notification.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ recipient: USER_ID, type: 'circle_deleted' })
    );
    expect(Notification.updateMany).toHaveBeenCalledWith(
      { circle: CIRCLE_ID, type: 'circle_invite', read: false },
      { $set: { read: true, readAt: expect.any(Date) } }
    );
  });

  test('does not notify anyone when the user owned no circles', async () => {
    jest.spyOn(User, 'findById').mockResolvedValue(fakeUser());
    jest.spyOn(Circle, 'find').mockResolvedValue([]);

    await deleteUser(USER_ID);
    await flush();

    expect(Notification.create).not.toHaveBeenCalled();
    expect(Notification.updateMany).not.toHaveBeenCalled();
  });

  test('deletes pages, reactions, album reactions, and comments for every album the user owns', async () => {
    jest.spyOn(User, 'findById').mockResolvedValue(fakeUser());
    jest.spyOn(Album, 'find').mockResolvedValue([
      { _id: ALBUM_ID, title: 'Summer' },
      { _id: OTHER_ALBUM_ID, title: 'Winter' },
    ]);
    const pageDeleteMany = jest.spyOn(Page, 'deleteMany');
    const reactionDeleteMany = jest.spyOn(Reaction, 'deleteMany');
    const albumReactionDeleteMany = jest.spyOn(AlbumReaction, 'deleteMany');
    const commentFind = jest.spyOn(Comment, 'find').mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const commentDeleteMany = jest.spyOn(Comment, 'deleteMany');
    const commentReactionDeleteMany = jest.spyOn(CommentReaction, 'deleteMany');

    await deleteUser(USER_ID);

    expect(pageDeleteMany).toHaveBeenCalledWith({ album: { $in: [ALBUM_ID, OTHER_ALBUM_ID] } });
    expect(reactionDeleteMany).toHaveBeenCalledWith({
      $or: [{ album: { $in: [ALBUM_ID, OTHER_ALBUM_ID] } }, { user: USER_ID }],
    });
    expect(albumReactionDeleteMany).toHaveBeenCalledWith({
      $or: [{ album: { $in: [ALBUM_ID, OTHER_ALBUM_ID] } }, { user: USER_ID }],
    });
    expect(commentFind).toHaveBeenNthCalledWith(
      1,
      { $or: [{ album: { $in: [ALBUM_ID, OTHER_ALBUM_ID] } }, { user: USER_ID }] },
      '_id'
    );
    expect(commentDeleteMany).toHaveBeenCalledWith({ _id: { $in: [] } });
    expect(commentReactionDeleteMany).toHaveBeenCalledWith({
      $or: [{ comment: { $in: [] } }, { album: { $in: [ALBUM_ID, OTHER_ALBUM_ID] } }, { user: USER_ID }],
    });
  });

  test('deletes the user\'s own reactions and comments even when they own no albums', async () => {
    jest.spyOn(User, 'findById').mockResolvedValue(fakeUser());
    jest.spyOn(Album, 'find').mockResolvedValue([]);
    const reactionDeleteMany = jest.spyOn(Reaction, 'deleteMany');
    jest.spyOn(Comment, 'find').mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const commentDeleteMany = jest.spyOn(Comment, 'deleteMany');
    const commentReactionDeleteMany = jest.spyOn(CommentReaction, 'deleteMany');

    await deleteUser(USER_ID);

    expect(reactionDeleteMany).toHaveBeenCalledWith({ $or: [{ album: { $in: [] } }, { user: USER_ID }] });
    expect(commentDeleteMany).toHaveBeenCalledWith({ _id: { $in: [] } });
    expect(commentReactionDeleteMany).toHaveBeenCalledWith({
      $or: [{ comment: { $in: [] } }, { album: { $in: [] } }, { user: USER_ID }],
    });
  });

  test('cascades to replies and reactions from other users on a comment this user posted on someone else\'s album', async () => {
    jest.spyOn(User, 'findById').mockResolvedValue(fakeUser());
    jest.spyOn(Album, 'find').mockResolvedValue([]);
    const OWN_COMMENT_ID = '507f1f77bcf86cd799439055';
    const OTHER_USER_REPLY_ID = '507f1f77bcf86cd799439066';
    const commentFind = jest
      .spyOn(Comment, 'find')
      .mockResolvedValueOnce([{ _id: OWN_COMMENT_ID }])
      .mockResolvedValueOnce([{ _id: OTHER_USER_REPLY_ID }]);
    const commentDeleteMany = jest.spyOn(Comment, 'deleteMany');
    const commentReactionDeleteMany = jest.spyOn(CommentReaction, 'deleteMany');

    await deleteUser(USER_ID);

    expect(commentFind).toHaveBeenNthCalledWith(2, { parentComment: { $in: [OWN_COMMENT_ID] } }, '_id');
    expect(commentDeleteMany).toHaveBeenCalledWith({
      _id: { $in: [OWN_COMMENT_ID, OTHER_USER_REPLY_ID] },
    });
    expect(commentReactionDeleteMany).toHaveBeenCalledWith({
      $or: [
        { comment: { $in: [OWN_COMMENT_ID, OTHER_USER_REPLY_ID] } },
        { album: { $in: [] } },
        { user: USER_ID },
      ],
    });
  });

  test('deletes the notification inbox but leaves notifications where the user is only the actor', async () => {
    jest.spyOn(User, 'findById').mockResolvedValue(fakeUser());
    const deleteMany = jest.spyOn(Notification, 'deleteMany');

    await deleteUser(USER_ID);

    expect(deleteMany).toHaveBeenCalledWith({ recipient: USER_ID });
    expect(deleteMany).not.toHaveBeenCalledWith(expect.objectContaining({ actor: USER_ID }));
  });

  test('deletes the user document last, after every cascade step', async () => {
    jest.spyOn(User, 'findById').mockResolvedValue(fakeUser());
    const callOrder = [];
    for (const [label, spy] of [
      ['Page.deleteMany', Page.deleteMany],
      ['Album.deleteMany', Album.deleteMany],
      ['Circle.deleteMany', Circle.deleteMany],
      ['Notification.deleteMany', Notification.deleteMany],
    ]) {
      spy.mockImplementation(() => {
        callOrder.push(label);
        return Promise.resolve({});
      });
    }
    jest.spyOn(User, 'deleteOne').mockImplementation(() => {
      callOrder.push('User.deleteOne');
      return Promise.resolve({});
    });

    await deleteUser(USER_ID);

    expect(callOrder[callOrder.length - 1]).toBe('User.deleteOne');
  });

  test('resolves with a summary of what was deleted', async () => {
    jest.spyOn(User, 'findById').mockResolvedValue(fakeUser({ username: 'zzcleanuptest' }));
    jest.spyOn(Album, 'find').mockResolvedValue([{ _id: ALBUM_ID, title: 'Summer' }]);
    jest.spyOn(Circle, 'find').mockResolvedValue([{ _id: CIRCLE_ID, name: 'Family', owner: USER_ID, members: [] }]);

    const result = await deleteUser(USER_ID);

    expect(result).toEqual({
      deletedUser: { _id: USER_ID, username: 'zzcleanuptest' },
      deletedAlbumCount: 1,
      deletedCircleCount: 1,
    });
  });
});
