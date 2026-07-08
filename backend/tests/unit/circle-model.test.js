const Circle = require('../../server/data/Circle');

const OWNER_ID = '507f1f77bcf86cd799439011';
const MEMBER_ID = '507f1f77bcf86cd799439022';

describe('Circle model', () => {
  describe('schema validation (offline)', () => {
    test('requires name and owner', () => {
      const err = new Circle({}).validateSync();
      expect(err.errors.name).toBeDefined();
      expect(err.errors.owner).toBeDefined();
    });

    test('accepts a valid circle and defaults description to an empty string', () => {
      const circle = new Circle({ name: 'Family', owner: OWNER_ID });
      expect(circle.validateSync()).toBeUndefined();
      expect(circle.description).toBe('');
      expect(circle.members).toEqual([]);
    });

    test('trims the description', () => {
      const circle = new Circle({
        name: 'Family',
        owner: OWNER_ID,
        description: '  Reunion crew  ',
      });
      expect(circle.description).toBe('Reunion crew');
    });

    test('rejects a description over 300 characters', () => {
      const err = new Circle({
        name: 'Family',
        owner: OWNER_ID,
        description: 'x'.repeat(301),
      }).validateSync();
      expect(err.errors.description).toBeDefined();
    });

    test('trims the name', () => {
      const circle = new Circle({
        name: '  The Sterling Family  ',
        owner: OWNER_ID,
      });
      expect(circle.name).toBe('The Sterling Family');
    });

    test('rejects a name over 80 characters', () => {
      const err = new Circle({
        name: 'x'.repeat(81),
        owner: OWNER_ID,
      }).validateSync();
      expect(err.errors.name).toBeDefined();
    });

    test('rejects more than 200 members', () => {
      const members = Array.from({ length: 201 }, (_, i) => ({
        user: OWNER_ID,
        addedAt: new Date(),
      }));
      const err = new Circle({
        name: 'Family',
        owner: OWNER_ID,
        members,
      }).validateSync();
      expect(err.errors.members).toBeDefined();
    });

    test('accepts exactly 200 members', () => {
      const members = Array.from({ length: 200 }, () => ({ user: OWNER_ID }));
      const circle = new Circle({
        name: 'Family',
        owner: OWNER_ID,
        members,
      });
      expect(circle.validateSync()).toBeUndefined();
    });

    test('a member subdocument requires a user', () => {
      const err = new Circle({
        name: 'Family',
        owner: OWNER_ID,
        members: [{}],
      }).validateSync();
      expect(err.errors['members.0.user']).toBeDefined();
    });

    test('defaults a member addedAt to now', () => {
      const circle = new Circle({
        name: 'Family',
        owner: OWNER_ID,
        members: [{ user: MEMBER_ID }],
      });
      expect(circle.members[0].addedAt).toBeInstanceOf(Date);
    });

    test('defaults a member status to pending — adding someone never grants access on its own', () => {
      const circle = new Circle({
        name: 'Family',
        owner: OWNER_ID,
        members: [{ user: MEMBER_ID }],
      });
      expect(circle.members[0].status).toBe('pending');
    });

    test('rejects a member status outside the enum', () => {
      const err = new Circle({
        name: 'Family',
        owner: OWNER_ID,
        members: [{ user: MEMBER_ID, status: 'invited' }],
      }).validateSync();
      expect(err.errors['members.0.status']).toBeDefined();
    });
  });

  describe('isOwnerOrMember', () => {
    const circle = new Circle({
      name: 'Family',
      owner: OWNER_ID,
      members: [{ user: MEMBER_ID, status: 'accepted' }],
    });

    test('is true for the owner', () => {
      expect(circle.isOwnerOrMember(OWNER_ID)).toBe(true);
    });

    test('is true for an accepted member', () => {
      expect(circle.isOwnerOrMember(MEMBER_ID)).toBe(true);
    });

    test('is false for a stranger', () => {
      expect(circle.isOwnerOrMember('507f1f77bcf86cd799439099')).toBe(false);
    });

    test('is false for a member who has not yet accepted', () => {
      const pending = new Circle({
        name: 'Family',
        owner: OWNER_ID,
        members: [{ user: MEMBER_ID }],
      });
      expect(pending.members[0].status).toBe('pending');
      expect(pending.isOwnerOrMember(MEMBER_ID)).toBe(false);
    });
  });

  describe('toJSON', () => {
    test('strips __v from serialized output', () => {
      const circle = new Circle({ name: 'Family', owner: OWNER_ID });
      const json = circle.toJSON();
      expect(json).not.toHaveProperty('__v');
      expect(json.name).toBe('Family');
    });
  });
});
