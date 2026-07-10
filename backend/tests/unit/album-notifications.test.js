const Circle = require('../../server/data/Circle');
const Notification = require('../../server/data/Notification');
const { notifyAlbumEvent } = require('../../server/utilities/album-notifications');

const flush = () => new Promise(setImmediate);

const OWNER_ID = '507f1f77bcf86cd799439011';
const ACTOR_ID = '507f1f77bcf86cd799439022';
const MEMBER_ID = '507f1f77bcf86cd799439033';
const PENDING_MEMBER_ID = '507f1f77bcf86cd799439044';
const CIRCLE_ID = '507f191e810c19729de860ea';
const ALBUM_ID = '507f191e810c19729de860eb';

const actorUser = { _id: ACTOR_ID, username: 'pan' };

const fakeAlbum = (overrides = {}) => ({
  _id: ALBUM_ID,
  title: 'Summer Trip',
  visibility: 'shared',
  sharedWithCircle: CIRCLE_ID,
  ...overrides,
});

const fakeCircle = (overrides = {}) => ({
  _id: CIRCLE_ID,
  name: 'The Sterling Family',
  owner: OWNER_ID,
  members: [
    { user: MEMBER_ID, status: 'accepted' },
    { user: PENDING_MEMBER_ID, status: 'pending' },
  ],
  ...overrides,
});

beforeEach(() => {
  jest.spyOn(Notification, 'create').mockResolvedValue({ _id: 'notif1' });
  jest.spyOn(Notification, 'pruneExcessForRecipient').mockResolvedValue(null);
});

describe('notifyAlbumEvent', () => {
  test('creates a notification for the circle owner and each accepted member, excluding the actor and pending invitees', async () => {
    jest.spyOn(Circle, 'findById').mockResolvedValue(fakeCircle());
    notifyAlbumEvent({ type: 'album_shared', album: fakeAlbum(), actorUser });
    await flush();

    expect(Notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: OWNER_ID,
        type: 'album_shared',
        circle: CIRCLE_ID,
        circleName: 'The Sterling Family',
        actorUsername: 'pan',
        album: ALBUM_ID,
        albumTitle: 'Summer Trip',
      })
    );
    expect(Notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ recipient: MEMBER_ID, type: 'album_shared' })
    );
    expect(Notification.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ recipient: PENDING_MEMBER_ID })
    );
    expect(Notification.create).toHaveBeenCalledTimes(2);
  });

  test('excludes the actor from recipients when the actor is the circle owner', async () => {
    jest.spyOn(Circle, 'findById').mockResolvedValue(fakeCircle());
    notifyAlbumEvent({
      type: 'album_updated',
      album: fakeAlbum(),
      actorUser: { _id: OWNER_ID, username: 'pan' },
    });
    await flush();

    expect(Notification.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ recipient: OWNER_ID })
    );
    expect(Notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ recipient: MEMBER_ID })
    );
  });

  test('does nothing for a private album', async () => {
    const findById = jest.spyOn(Circle, 'findById');
    notifyAlbumEvent({ type: 'album_updated', album: fakeAlbum({ visibility: 'private' }), actorUser });
    await flush();

    expect(findById).not.toHaveBeenCalled();
    expect(Notification.create).not.toHaveBeenCalled();
  });

  test('does nothing for a public album', async () => {
    const findById = jest.spyOn(Circle, 'findById');
    notifyAlbumEvent({ type: 'album_updated', album: fakeAlbum({ visibility: 'public' }), actorUser });
    await flush();

    expect(findById).not.toHaveBeenCalled();
    expect(Notification.create).not.toHaveBeenCalled();
  });

  test('does nothing for a "shared" album with no circle attached', async () => {
    const findById = jest.spyOn(Circle, 'findById');
    notifyAlbumEvent({
      type: 'album_updated',
      album: fakeAlbum({ sharedWithCircle: null }),
      actorUser,
    });
    await flush();

    expect(findById).not.toHaveBeenCalled();
    expect(Notification.create).not.toHaveBeenCalled();
  });

  test('does nothing when the shared circle no longer exists', async () => {
    jest.spyOn(Circle, 'findById').mockResolvedValue(null);
    notifyAlbumEvent({ type: 'album_deleted', album: fakeAlbum(), actorUser });
    await flush();

    expect(Notification.create).not.toHaveBeenCalled();
  });

  test('never throws when Notification.create fails — logs and swallows', async () => {
    jest.spyOn(Circle, 'findById').mockResolvedValue(fakeCircle());
    Notification.create.mockRejectedValue(new Error('db down'));
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() =>
      notifyAlbumEvent({ type: 'album_photos_added', album: fakeAlbum(), actorUser })
    ).not.toThrow();
    await flush();

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  test('never throws when the circle document is malformed (defensive against a bad caller)', async () => {
    jest.spyOn(Circle, 'findById').mockResolvedValue({ owner: OWNER_ID }); // no members array
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() =>
      notifyAlbumEvent({ type: 'album_shared', album: fakeAlbum(), actorUser })
    ).not.toThrow();
    await flush();

    expect(Notification.create).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
