jest.mock('../../server/utilities/storage', () => ({
  removeUserDir: jest.fn(),
  removeAvatarDir: jest.fn(),
}));

const User = require('../../server/data/User');
const Album = require('../../server/data/Album');
const Page = require('../../server/data/Page');
const Reaction = require('../../server/data/Reaction');
const AlbumReaction = require('../../server/data/AlbumReaction');
const Circle = require('../../server/data/Circle');
const Notification = require('../../server/data/Notification');
const storage = require('../../server/utilities/storage');
const { deleteUser, planUserDeletion, UserNotFoundError } = require('../../server/utilities/user-deletion');

const USER_ID = '507f1f77bcf86cd799439011';
const ALBUM_ID = '507f191e810c19729de860ea';
const OTHER_ALBUM_ID = '507f191e810c19729de860eb';
const CIRCLE_ID = '507f1f77bcf86cd799439033';

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
  jest.spyOn(Album, 'deleteMany').mockResolvedValue({});
  jest.spyOn(Circle, 'deleteMany').mockResolvedValue({});
  jest.spyOn(Notification, 'deleteMany').mockResolvedValue({});
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
    jest.spyOn(Circle, 'find').mockResolvedValue([{ _id: CIRCLE_ID, name: 'Family' }]);
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

  test('deletes pages, reactions, and album reactions for every album the user owns', async () => {
    jest.spyOn(User, 'findById').mockResolvedValue(fakeUser());
    jest.spyOn(Album, 'find').mockResolvedValue([
      { _id: ALBUM_ID, title: 'Summer' },
      { _id: OTHER_ALBUM_ID, title: 'Winter' },
    ]);
    const pageDeleteMany = jest.spyOn(Page, 'deleteMany');
    const reactionDeleteMany = jest.spyOn(Reaction, 'deleteMany');
    const albumReactionDeleteMany = jest.spyOn(AlbumReaction, 'deleteMany');

    await deleteUser(USER_ID);

    expect(pageDeleteMany).toHaveBeenCalledWith({ album: { $in: [ALBUM_ID, OTHER_ALBUM_ID] } });
    expect(reactionDeleteMany).toHaveBeenCalledWith({
      $or: [{ album: { $in: [ALBUM_ID, OTHER_ALBUM_ID] } }, { user: USER_ID }],
    });
    expect(albumReactionDeleteMany).toHaveBeenCalledWith({
      $or: [{ album: { $in: [ALBUM_ID, OTHER_ALBUM_ID] } }, { user: USER_ID }],
    });
  });

  test('deletes the user\'s own reactions even when they own no albums', async () => {
    jest.spyOn(User, 'findById').mockResolvedValue(fakeUser());
    jest.spyOn(Album, 'find').mockResolvedValue([]);
    const reactionDeleteMany = jest.spyOn(Reaction, 'deleteMany');

    await deleteUser(USER_ID);

    expect(reactionDeleteMany).toHaveBeenCalledWith({ $or: [{ album: { $in: [] } }, { user: USER_ID }] });
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
    jest.spyOn(Circle, 'find').mockResolvedValue([{ _id: CIRCLE_ID, name: 'Family' }]);

    const result = await deleteUser(USER_ID);

    expect(result).toEqual({
      deletedUser: { _id: USER_ID, username: 'zzcleanuptest' },
      deletedAlbumCount: 1,
      deletedCircleCount: 1,
    });
  });
});
