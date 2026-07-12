const User = require('../../server/data/User');
const Circle = require('../../server/data/Circle');
const {
  parsePage,
  circleRecipientIds,
  resolveUsernames,
  checkAlbumReadAccess,
  fetchCirclesForAlbums,
} = require('../../server/utilities/controller-helpers');

describe('circleRecipientIds', () => {
  const OWNER_ID = '507f1f77bcf86cd799439011';
  const MEMBER_ID = '507f1f77bcf86cd799439033';
  const OTHER_MEMBER_ID = '507f1f77bcf86cd799439044';

  test('includes the owner and every accepted member', () => {
    const circle = {
      owner: OWNER_ID,
      members: [
        { user: MEMBER_ID, status: 'accepted' },
        { user: OTHER_MEMBER_ID, status: 'accepted' },
      ],
    };
    expect(circleRecipientIds(circle, 'someone-else')).toEqual(
      expect.arrayContaining([OWNER_ID, MEMBER_ID, OTHER_MEMBER_ID])
    );
  });

  test('excludes a still-pending (not yet accepted) member', () => {
    const circle = { owner: OWNER_ID, members: [{ user: MEMBER_ID, status: 'pending' }] };
    expect(circleRecipientIds(circle, 'someone-else')).not.toContain(MEMBER_ID);
  });

  test('excludes the acting user, whether they are the owner or a member', () => {
    const circle = { owner: OWNER_ID, members: [{ user: MEMBER_ID, status: 'accepted' }] };
    expect(circleRecipientIds(circle, OWNER_ID)).not.toContain(OWNER_ID);
    expect(circleRecipientIds(circle, MEMBER_ID)).not.toContain(MEMBER_ID);
  });

  test('never returns the same id twice, even if the owner also appears in members', () => {
    const circle = {
      owner: OWNER_ID,
      members: [{ user: OWNER_ID, status: 'accepted' }, { user: MEMBER_ID, status: 'accepted' }],
    };
    const recipientIds = circleRecipientIds(circle, 'someone-else');
    expect(recipientIds.filter((id) => id === OWNER_ID)).toHaveLength(1);
  });
});

describe('parsePage', () => {
  test('defaults to page 1 when no page is given', () => {
    expect(parsePage({})).toBe(1);
    expect(parsePage(undefined)).toBe(1);
  });

  test('defaults to page 1 for a non-numeric page', () => {
    expect(parsePage({ page: 'not-a-number' })).toBe(1);
  });

  test('defaults to page 1 for zero or negative page numbers', () => {
    expect(parsePage({ page: '0' })).toBe(1);
    expect(parsePage({ page: '-5' })).toBe(1);
  });

  test('parses a valid page number', () => {
    expect(parsePage({ page: '3' })).toBe(3);
  });

  test('caps an unreasonably large page number instead of passing it through', () => {
    expect(parsePage({ page: '99999999999' })).toBe(100000);
  });
});

describe('resolveUsernames', () => {
  const USER_A = '507f1f77bcf86cd799439011';
  const USER_B = '507f1f77bcf86cd799439022';

  test('returns an empty array for an empty input without querying', async () => {
    const find = jest.spyOn(User, 'find');

    const usernames = await resolveUsernames([]);

    expect(usernames).toEqual([]);
    expect(find).not.toHaveBeenCalled();
  });

  test('resolves ids to usernames in the same order as the input', async () => {
    jest.spyOn(User, 'find').mockResolvedValue([
      { _id: USER_A, username: 'pan' },
      { _id: USER_B, username: 'maria' },
    ]);

    const usernames = await resolveUsernames([USER_B, USER_A]);

    expect(usernames).toEqual(['maria', 'pan']);
  });

  test('falls back to DELETED_USER_LABEL for an id with no matching user', async () => {
    jest.spyOn(User, 'find').mockResolvedValue([{ _id: USER_A, username: 'pan' }]);

    const usernames = await resolveUsernames([USER_A, USER_B]);

    expect(usernames).toEqual(['pan', 'Deleted user']);
  });

  test('queries User.find once with deduped ids, but still maps every duplicate in the input', async () => {
    const find = jest
      .spyOn(User, 'find')
      .mockResolvedValue([{ _id: USER_A, username: 'pan' }, { _id: USER_B, username: 'maria' }]);

    const usernames = await resolveUsernames([USER_A, USER_B, USER_A]);

    expect(usernames).toEqual(['pan', 'maria', 'pan']);
    expect(find).toHaveBeenCalledTimes(1);
    expect(find.mock.calls[0][0]).toEqual({ _id: { $in: [USER_A, USER_B] } });
  });

  test('accepts ObjectId-like values (with a toString method), not just plain strings', async () => {
    jest.spyOn(User, 'find').mockResolvedValue([{ _id: USER_A, username: 'pan' }]);

    const usernames = await resolveUsernames([{ toString: () => USER_A }]);

    expect(usernames).toEqual(['pan']);
  });
});

describe('fetchCirclesForAlbums', () => {
  const USER_ID = '507f1f77bcf86cd799439011';
  const CIRCLE_A = '507f1f77bcf86cd799439aaa';
  const CIRCLE_B = '507f1f77bcf86cd799439bbb';

  test('returns an empty map without querying when no album references a circle', async () => {
    const find = jest.spyOn(Circle, 'find');

    const circleById = await fetchCirclesForAlbums([{ visibility: 'public' }, { visibility: 'private' }]);

    expect(circleById.size).toBe(0);
    expect(find).not.toHaveBeenCalled();
  });

  test('queries Circle.find once with every distinct circle id, however many albums reference it', async () => {
    const find = jest
      .spyOn(Circle, 'find')
      .mockResolvedValue([{ _id: CIRCLE_A, isOwnerOrMember: () => true }]);

    const circleById = await fetchCirclesForAlbums([
      { visibility: 'shared', sharedWithCircle: CIRCLE_A },
      { visibility: 'shared', sharedWithCircle: CIRCLE_A },
      { visibility: 'public' },
    ]);

    expect(find).toHaveBeenCalledTimes(1);
    expect(find.mock.calls[0][0]).toEqual({ _id: { $in: [CIRCLE_A] } });
    expect(circleById.get(CIRCLE_A)).toBeDefined();
  });

  test('checkAlbumReadAccess, given a pre-fetched map, resolves access without any further Circle query', async () => {
    const find = jest.spyOn(Circle, 'find');
    const user = { _id: USER_ID, roles: [] };
    const memberAlbum = { owner: 'someone-else', visibility: 'shared', sharedWithCircle: CIRCLE_A };
    const strangerAlbum = { owner: 'someone-else', visibility: 'shared', sharedWithCircle: CIRCLE_B };
    const circleById = new Map([
      [CIRCLE_A, { isOwnerOrMember: () => true }],
      [CIRCLE_B, { isOwnerOrMember: () => false }],
    ]);

    const memberResult = await checkAlbumReadAccess(memberAlbum, user, circleById);
    const strangerResult = await checkAlbumReadAccess(strangerAlbum, user, circleById);

    expect(memberResult).toBeNull();
    expect(strangerResult).toEqual({ status: 403, error: 'This album is shared with a specific circle' });
    expect(find).not.toHaveBeenCalled();
  });
});
