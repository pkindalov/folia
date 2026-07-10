const { parsePage, circleRecipientIds } = require('../../server/utilities/controller-helpers');

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
