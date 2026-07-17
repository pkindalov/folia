const Circle = require('../../server/data/Circle');
const Notification = require('../../server/data/Notification');
const {
  notifyAlbumEvent,
  notifyPageReaction,
  notifyAlbumReaction,
  notifyPageComment,
  notifyCommentReply,
} = require('../../server/utilities/album-notifications');

const flush = () => new Promise(setImmediate);

const OWNER_ID = '507f1f77bcf86cd799439011';
const ACTOR_ID = '507f1f77bcf86cd799439022';
const MEMBER_ID = '507f1f77bcf86cd799439033';
const PENDING_MEMBER_ID = '507f1f77bcf86cd799439044';
const PARENT_AUTHOR_ID = '507f1f77bcf86cd799439055';
const CIRCLE_ID = '507f191e810c19729de860ea';
const ALBUM_ID = '507f191e810c19729de860eb';
const PAGE_ID = '507f191e810c19729de860ec';

const actorUser = { _id: ACTOR_ID, username: 'pan' };

const fakeAlbum = (overrides = {}) => ({
  _id: ALBUM_ID,
  title: 'Summer Trip',
  visibility: 'shared',
  sharedWithCircle: CIRCLE_ID,
  owner: { toString: () => OWNER_ID },
  ...overrides,
});

const fakePage = (overrides = {}) => ({ _id: PAGE_ID, ...overrides });

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
        actor: ACTOR_ID,
        album: ALBUM_ID,
        albumTitle: 'Summer Trip',
      })
    );
    expect(Notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ recipient: MEMBER_ID, type: 'album_shared', actor: ACTOR_ID })
    );
    expect(Notification.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ recipient: PENDING_MEMBER_ID })
    );
    expect(Notification.create).toHaveBeenCalledTimes(2);
  });

  test('sets page on the created notification when a representative page is passed', async () => {
    jest.spyOn(Circle, 'findById').mockResolvedValue(fakeCircle());
    notifyAlbumEvent({ type: 'album_photos_added', album: fakeAlbum(), actorUser, page: fakePage() });
    await flush();

    expect(Notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ recipient: MEMBER_ID, type: 'album_photos_added', page: PAGE_ID })
    );
  });

  test('does not set page on the created notification when none is passed', async () => {
    jest.spyOn(Circle, 'findById').mockResolvedValue(fakeCircle());
    notifyAlbumEvent({ type: 'album_shared', album: fakeAlbum(), actorUser });
    await flush();

    const call = Notification.create.mock.calls.find(([arg]) => arg.recipient === MEMBER_ID);
    expect(call[0]).not.toHaveProperty('page');
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

describe('notifyPageReaction', () => {
  test('notifies the album owner with the page, reaction type and reactor username', async () => {
    notifyPageReaction({
      page: fakePage(),
      album: fakeAlbum(),
      reactionType: 'love',
      reactorUser: actorUser,
    });
    await flush();

    expect(Notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: OWNER_ID,
        type: 'page_reaction',
        actorUsername: 'pan',
        actor: ACTOR_ID,
        album: ALBUM_ID,
        albumTitle: 'Summer Trip',
        page: PAGE_ID,
        reactionType: 'love',
      })
    );
  });

  test('does not notify when the reactor is the album owner (no self-notification)', async () => {
    notifyPageReaction({
      page: fakePage(),
      album: fakeAlbum(),
      reactionType: 'love',
      reactorUser: { _id: OWNER_ID, username: 'owner' },
    });
    await flush();

    expect(Notification.create).not.toHaveBeenCalled();
  });

  test('prunes the recipient\'s notifications after creating one', async () => {
    notifyPageReaction({
      page: fakePage(),
      album: fakeAlbum(),
      reactionType: 'like',
      reactorUser: actorUser,
    });
    await flush();

    expect(Notification.pruneExcessForRecipient).toHaveBeenCalledWith(OWNER_ID);
  });

  test('never throws when Notification.create fails — logs and swallows', async () => {
    Notification.create.mockRejectedValue(new Error('db down'));
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() =>
      notifyPageReaction({
        page: fakePage(),
        album: fakeAlbum(),
        reactionType: 'wow',
        reactorUser: actorUser,
      })
    ).not.toThrow();
    await flush();

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

describe('notifyPageComment', () => {
  test('notifies the album owner with the page, snapshot commentText and commenter username', async () => {
    notifyPageComment({
      page: fakePage(),
      album: fakeAlbum(),
      commentText: 'What a lovely photo!',
      commenterUser: actorUser,
    });
    await flush();

    expect(Notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: OWNER_ID,
        type: 'page_comment',
        actorUsername: 'pan',
        actor: ACTOR_ID,
        album: ALBUM_ID,
        albumTitle: 'Summer Trip',
        page: PAGE_ID,
        commentText: 'What a lovely photo!',
      })
    );
  });

  test('does not notify when the commenter is the album owner (no self-notification)', async () => {
    notifyPageComment({
      page: fakePage(),
      album: fakeAlbum(),
      commentText: 'Nice!',
      commenterUser: { _id: OWNER_ID, username: 'owner' },
    });
    await flush();

    expect(Notification.create).not.toHaveBeenCalled();
  });

  test('prunes the recipient\'s notifications after creating one', async () => {
    notifyPageComment({
      page: fakePage(),
      album: fakeAlbum(),
      commentText: 'Nice!',
      commenterUser: actorUser,
    });
    await flush();

    expect(Notification.pruneExcessForRecipient).toHaveBeenCalledWith(OWNER_ID);
  });

  test('never throws when Notification.create fails — logs and swallows', async () => {
    Notification.create.mockRejectedValue(new Error('db down'));
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() =>
      notifyPageComment({
        page: fakePage(),
        album: fakeAlbum(),
        commentText: 'Nice!',
        commenterUser: actorUser,
      })
    ).not.toThrow();
    await flush();

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

describe('notifyCommentReply', () => {
  test('notifies the parent comment\'s author (not the album owner) with the page, snapshot commentText and replier username', async () => {
    notifyCommentReply({
      page: fakePage(),
      album: fakeAlbum(),
      commentText: 'Totally agree!',
      replierUser: actorUser,
      parentCommentAuthorId: PARENT_AUTHOR_ID,
    });
    await flush();

    expect(Notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: PARENT_AUTHOR_ID,
        type: 'comment_reply',
        actorUsername: 'pan',
        actor: ACTOR_ID,
        album: ALBUM_ID,
        albumTitle: 'Summer Trip',
        page: PAGE_ID,
        commentText: 'Totally agree!',
      })
    );
  });

  test('does not notify when replying to your own comment (no self-notification)', async () => {
    notifyCommentReply({
      page: fakePage(),
      album: fakeAlbum(),
      commentText: 'Adding more context',
      replierUser: actorUser,
      parentCommentAuthorId: ACTOR_ID,
    });
    await flush();

    expect(Notification.create).not.toHaveBeenCalled();
  });

  test('prunes the recipient\'s notifications after creating one', async () => {
    notifyCommentReply({
      page: fakePage(),
      album: fakeAlbum(),
      commentText: 'Totally agree!',
      replierUser: actorUser,
      parentCommentAuthorId: PARENT_AUTHOR_ID,
    });
    await flush();

    expect(Notification.pruneExcessForRecipient).toHaveBeenCalledWith(PARENT_AUTHOR_ID);
  });

  test('never throws when Notification.create fails — logs and swallows', async () => {
    Notification.create.mockRejectedValue(new Error('db down'));
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() =>
      notifyCommentReply({
        page: fakePage(),
        album: fakeAlbum(),
        commentText: 'Totally agree!',
        replierUser: actorUser,
        parentCommentAuthorId: PARENT_AUTHOR_ID,
      })
    ).not.toThrow();
    await flush();

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

describe('notifyAlbumReaction', () => {
  test('notifies the album owner with the actor and album snapshot', async () => {
    notifyAlbumReaction({ album: fakeAlbum(), reactorUser: actorUser });
    await flush();

    expect(Notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: OWNER_ID,
        type: 'album_reaction',
        actorUsername: 'pan',
        actor: ACTOR_ID,
        album: ALBUM_ID,
        albumTitle: 'Summer Trip',
      })
    );
  });

  test('does not notify when the reactor is the album owner (no self-notification)', async () => {
    notifyAlbumReaction({
      album: fakeAlbum(),
      reactorUser: { _id: OWNER_ID, username: 'owner' },
    });
    await flush();

    expect(Notification.create).not.toHaveBeenCalled();
  });

  test('prunes the recipient\'s notifications after creating one', async () => {
    notifyAlbumReaction({ album: fakeAlbum(), reactorUser: actorUser });
    await flush();

    expect(Notification.pruneExcessForRecipient).toHaveBeenCalledWith(OWNER_ID);
  });

  test('never throws when Notification.create fails — logs and swallows', async () => {
    Notification.create.mockRejectedValue(new Error('db down'));
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() =>
      notifyAlbumReaction({ album: fakeAlbum(), reactorUser: actorUser })
    ).not.toThrow();
    await flush();

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
