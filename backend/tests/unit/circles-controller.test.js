const Circle = require('../../server/data/Circle');
const User = require('../../server/data/User');
const Album = require('../../server/data/Album');
const Notification = require('../../server/data/Notification');
const controller = require('../../server/controllers/circles-controller');

const flush = () => new Promise(setImmediate);

const OWNER_ID = '507f1f77bcf86cd799439011';
const OTHER_ID = '507f1f77bcf86cd799439022';
const MEMBER_ID = '507f1f77bcf86cd799439033';
const NEW_MEMBER_ID = '507f1f77bcf86cd799439044';
const CIRCLE_ID = '507f191e810c19729de860ea';

const owner = { _id: OWNER_ID, username: 'pan', roles: ['User'] };
const stranger = { _id: OTHER_ID, username: 'maria', roles: ['User'] };
const admin = { _id: OTHER_ID, username: 'root', roles: ['Admin'] };
const member = { _id: MEMBER_ID, username: 'sam', roles: ['User'] };

const ALL_USERS = [
  { _id: OWNER_ID, username: 'pan' },
  { _id: OTHER_ID, username: 'maria' },
  { _id: MEMBER_ID, username: 'sam' },
  { _id: NEW_MEMBER_ID, username: 'jules' },
];

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const fakeCircle = (overrides = {}) => ({
  _id: CIRCLE_ID,
  name: 'The Sterling Family',
  description: '',
  owner: OWNER_ID,
  members: [],
  save: jest.fn().mockImplementation(function () {
    return Promise.resolve(this);
  }),
  deleteOne: jest.fn().mockResolvedValue({}),
  isOwnerOrMember: function (userId) {
    const id = userId.toString();
    return (
      this.owner.toString() === id ||
      this.members.some((member) => member.user.toString() === id && member.status === 'accepted')
    );
  },
  toJSON: function () {
    const { toJSON: _drop, save: _drop2, deleteOne: _drop3, isOwnerOrMember: _drop4, ...rest } =
      this;
    return rest;
  },
  ...overrides,
});

beforeEach(() => {
  jest.spyOn(User, 'find').mockResolvedValue(ALL_USERS);
  jest.spyOn(Album, 'updateMany').mockResolvedValue({ acknowledged: true, modifiedCount: 0 });
  jest.spyOn(Notification, 'create').mockResolvedValue({ _id: 'notif1' });
  jest.spyOn(Notification, 'pruneExcessForRecipient').mockResolvedValue(null);
  jest.spyOn(Notification, 'updateMany').mockResolvedValue({ acknowledged: true, modifiedCount: 0 });
});

describe('circles-controller', () => {
  describe('create — validation', () => {
    test.each([
      ['empty body', {}],
      ['empty name', { name: '' }],
      ['whitespace-only name', { name: '   ' }],
      ['non-string name (injection)', { name: { $gt: '' } }],
      ['name over 80 chars', { name: 'x'.repeat(81) }],
      ['description over 300 chars', { name: 'Family', description: 'x'.repeat(301) }],
      ['non-string description (injection)', { name: 'Family', description: { $gt: '' } }],
    ])('rejects %s with 400', (_name, body) => {
      const create = jest.spyOn(Circle, 'create');
      const res = mockRes();
      controller.create({ body, user: owner }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(create).not.toHaveBeenCalled();
    });
  });

  describe('create — behavior', () => {
    test('sets the owner from the authenticated user, never from the body', async () => {
      const create = jest.spyOn(Circle, 'create').mockResolvedValue(fakeCircle());
      controller.create(
        { body: { name: 'Family', owner: OTHER_ID }, user: owner },
        mockRes()
      );
      await flush();
      expect(create.mock.calls[0][0].owner).toBe(OWNER_ID);
    });

    test('trims the name and defaults description to an empty string', async () => {
      const create = jest.spyOn(Circle, 'create').mockResolvedValue(fakeCircle());
      controller.create({ body: { name: '  Family  ' }, user: owner }, mockRes());
      await flush();
      expect(create.mock.calls[0][0].name).toBe('Family');
      expect(create.mock.calls[0][0].description).toBe('');
    });

    test('trims the description on create', async () => {
      const create = jest.spyOn(Circle, 'create').mockResolvedValue(fakeCircle());
      controller.create(
        { body: { name: 'Family', description: '  Reunion crew  ' }, user: owner },
        mockRes()
      );
      await flush();
      expect(create.mock.calls[0][0].description).toBe('Reunion crew');
    });

    test('accepts a description that only exceeds 300 characters before trimming', () => {
      const create = jest.spyOn(Circle, 'create');
      const res = mockRes();
      controller.create(
        { body: { name: 'Family', description: `${'x'.repeat(300)}   ` }, user: owner },
        res
      );
      expect(res.status).not.toHaveBeenCalledWith(400);
      expect(create).toHaveBeenCalled();
    });

    test('responds 201 with the created circle', async () => {
      jest.spyOn(Circle, 'create').mockResolvedValue(fakeCircle());
      const res = mockRes();
      controller.create({ body: { name: 'Family' }, user: owner }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ circle: expect.objectContaining({ ownerUsername: 'pan' }) })
      );
    });
  });

  function mockCircleQuery(circles) {
    const query = {};
    query.sort = jest.fn().mockReturnValue(query);
    query.skip = jest.fn().mockReturnValue(query);
    query.limit = jest.fn().mockResolvedValue(circles);
    return query;
  }

  describe('list', () => {
    test("returns circles the requester owns or is a member of", async () => {
      const circle = fakeCircle();
      const find = jest.spyOn(Circle, 'find').mockReturnValue(mockCircleQuery([circle]));
      jest.spyOn(Circle, 'countDocuments').mockResolvedValue(1);
      const res = mockRes();
      controller.list({ user: owner, query: {} }, res);
      await flush();
      expect(find).toHaveBeenCalledWith({
        $or: [
          { owner: OWNER_ID },
          { members: { $elemMatch: { user: OWNER_ID, status: 'accepted' } } },
        ],
      });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ total: 1, page: 1, limit: 12 })
      );
    });

    test('skips to the requested page', async () => {
      const query = mockCircleQuery([]);
      jest.spyOn(Circle, 'find').mockReturnValue(query);
      jest.spyOn(Circle, 'countDocuments').mockResolvedValue(30);
      const res = mockRes();
      controller.list({ user: owner, query: { page: '3' } }, res);
      await flush();
      expect(query.skip).toHaveBeenCalledWith(24);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ page: 3, total: 30 }));
    });

    test('returns 500 when the query fails', async () => {
      const query = mockCircleQuery([]);
      query.limit = jest.fn().mockRejectedValue(new Error('x'));
      jest.spyOn(Circle, 'find').mockReturnValue(query);
      jest.spyOn(Circle, 'countDocuments').mockResolvedValue(0);
      const res = mockRes();
      controller.list({ user: owner, query: {} }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getOne', () => {
    test('404 for a malformed id', () => {
      const findById = jest.spyOn(Circle, 'findById');
      const res = mockRes();
      controller.getOne({ params: { id: 'not-an-objectid' }, user: owner }, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(findById).not.toHaveBeenCalled();
    });

    test('404 when the circle does not exist', async () => {
      jest.spyOn(Circle, 'findById').mockResolvedValue(null);
      const res = mockRes();
      controller.getOne({ params: { id: CIRCLE_ID }, user: owner }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('403 for a stranger who is neither owner nor member', async () => {
      jest.spyOn(Circle, 'findById').mockResolvedValue(fakeCircle());
      const res = mockRes();
      controller.getOne({ params: { id: CIRCLE_ID }, user: stranger }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('owner can view their circle', async () => {
      jest.spyOn(Circle, 'findById').mockResolvedValue(fakeCircle());
      const res = mockRes();
      controller.getOne({ params: { id: CIRCLE_ID }, user: owner }, res);
      await flush();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ circle: expect.objectContaining({ name: 'The Sterling Family' }) })
      );
    });

    test('an accepted member can view the circle', async () => {
      jest.spyOn(Circle, 'findById').mockResolvedValue(
        fakeCircle({ members: [{ user: MEMBER_ID, status: 'accepted', addedAt: new Date() }] })
      );
      const res = mockRes();
      controller.getOne({ params: { id: CIRCLE_ID }, user: member }, res);
      await flush();
      expect(res.status).not.toHaveBeenCalledWith(403);
    });

    test('a pending (not yet accepted) invitee cannot view the circle', async () => {
      jest.spyOn(Circle, 'findById').mockResolvedValue(
        fakeCircle({ members: [{ user: MEMBER_ID, status: 'pending', addedAt: new Date() }] })
      );
      const res = mockRes();
      controller.getOne({ params: { id: CIRCLE_ID }, user: member }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('an Admin can view any circle', async () => {
      jest.spyOn(Circle, 'findById').mockResolvedValue(fakeCircle());
      const res = mockRes();
      controller.getOne({ params: { id: CIRCLE_ID }, user: admin }, res);
      await flush();
      expect(res.status).not.toHaveBeenCalledWith(403);
    });

    test('falls back to a placeholder label when a referenced User was deleted', async () => {
      jest
        .spyOn(Circle, 'findById')
        .mockResolvedValue(
          fakeCircle({ members: [{ user: MEMBER_ID, addedAt: new Date() }] })
        );
      // The owner and member usernames are missing from the lookup — as if
      // both User documents had been deleted.
      jest.spyOn(User, 'find').mockResolvedValue([]);
      const res = mockRes();
      controller.getOne({ params: { id: CIRCLE_ID }, user: owner }, res);
      await flush();
      expect(res.json).toHaveBeenCalledWith({
        circle: expect.objectContaining({
          ownerUsername: 'Deleted user',
          members: [expect.objectContaining({ username: 'Deleted user' })],
        }),
      });
    });
  });

  describe('update', () => {
    test('403 when a non-owner tries to update', async () => {
      const circle = fakeCircle();
      jest.spyOn(Circle, 'findById').mockResolvedValue(circle);
      const res = mockRes();
      controller.update({ params: { id: CIRCLE_ID }, body: { name: 'New' }, user: stranger }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(circle.save).not.toHaveBeenCalled();
    });

    test('404 for a missing circle', async () => {
      jest.spyOn(Circle, 'findById').mockResolvedValue(null);
      const res = mockRes();
      controller.update({ params: { id: CIRCLE_ID }, body: { name: 'New' }, user: owner }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('rejects invalid partial input before touching the DB', () => {
      const findById = jest.spyOn(Circle, 'findById');
      const res = mockRes();
      controller.update(
        { params: { id: CIRCLE_ID }, body: { description: 'x'.repeat(301) }, user: owner },
        res
      );
      expect(res.status).toHaveBeenCalledWith(400);
      expect(findById).not.toHaveBeenCalled();
    });

    test('trims the description on update', async () => {
      const circle = fakeCircle({ name: 'Old', description: 'Original' });
      jest.spyOn(Circle, 'findById').mockResolvedValue(circle);
      const res = mockRes();
      controller.update(
        { params: { id: CIRCLE_ID }, body: { description: '  Padded  ' }, user: owner },
        res
      );
      await flush();
      expect(circle.description).toBe('Padded');
    });

    test('partial update: only provided fields change', async () => {
      const circle = fakeCircle({ name: 'Old', description: 'Original' });
      jest.spyOn(Circle, 'findById').mockResolvedValue(circle);
      const res = mockRes();
      controller.update(
        { params: { id: CIRCLE_ID }, body: { description: 'Updated' }, user: owner },
        res
      );
      await flush();
      expect(circle.name).toBe('Old');
      expect(circle.description).toBe('Updated');
      expect(circle.save).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    test('403 when a non-owner tries to delete', async () => {
      const circle = fakeCircle();
      jest.spyOn(Circle, 'findById').mockResolvedValue(circle);
      const res = mockRes();
      controller.remove({ params: { id: CIRCLE_ID }, user: stranger }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(circle.deleteOne).not.toHaveBeenCalled();
      expect(Album.updateMany).not.toHaveBeenCalled();
    });

    test('owner can delete the circle', async () => {
      const circle = fakeCircle();
      jest.spyOn(Circle, 'findById').mockResolvedValue(circle);
      const res = mockRes();
      controller.remove({ params: { id: CIRCLE_ID }, user: owner }, res);
      await flush();
      expect(circle.deleteOne).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ deleted: true });
    });

    test('resets any album shared with the deleted circle back to private', async () => {
      const circle = fakeCircle();
      jest.spyOn(Circle, 'findById').mockResolvedValue(circle);
      const res = mockRes();
      controller.remove({ params: { id: CIRCLE_ID }, user: owner }, res);
      await flush();
      expect(Album.updateMany).toHaveBeenCalledWith(
        { sharedWithCircle: CIRCLE_ID },
        { sharedWithCircle: null, visibility: 'private' }
      );
    });

    test('an Admin can delete any circle', async () => {
      const circle = fakeCircle();
      jest.spyOn(Circle, 'findById').mockResolvedValue(circle);
      const res = mockRes();
      controller.remove({ params: { id: CIRCLE_ID }, user: admin }, res);
      await flush();
      expect(circle.deleteOne).toHaveBeenCalled();
    });

    test('never deletes the circle when unsharing its albums fails, so no album is left pointing at a deleted circle', async () => {
      const circle = fakeCircle();
      jest.spyOn(Circle, 'findById').mockResolvedValue(circle);
      jest.spyOn(Album, 'updateMany').mockRejectedValue(new Error('db down'));
      const res = mockRes();
      controller.remove({ params: { id: CIRCLE_ID }, user: owner }, res);
      await flush();
      expect(circle.deleteOne).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
    });

    test('reports the specific partial-failure state when albums are unshared but the delete itself fails', async () => {
      const circle = fakeCircle();
      circle.deleteOne.mockRejectedValue(new Error('db down'));
      jest.spyOn(Circle, 'findById').mockResolvedValue(circle);
      const res = mockRes();
      controller.remove({ params: { id: CIRCLE_ID }, user: owner }, res);
      await flush();
      expect(Album.updateMany).toHaveBeenCalled();
      expect(circle.deleteOne).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: "This circle's albums were unshared, but deleting the circle failed. Please try again.",
      });
    });

    test('marks any still-pending invite notifications for the circle as read once it is deleted', async () => {
      const circle = fakeCircle();
      jest.spyOn(Circle, 'findById').mockResolvedValue(circle);
      const res = mockRes();
      controller.remove({ params: { id: CIRCLE_ID }, user: owner }, res);
      await flush();
      expect(Notification.updateMany).toHaveBeenCalledWith(
        { circle: CIRCLE_ID, type: 'circle_invite', read: false },
        { $set: { read: true, readAt: expect.any(Date) } }
      );
    });

    test('still responds with deleted:true when marking invite notifications read fails', async () => {
      const circle = fakeCircle();
      jest.spyOn(Circle, 'findById').mockResolvedValue(circle);
      Notification.updateMany.mockRejectedValue(new Error('db down'));
      const res = mockRes();
      controller.remove({ params: { id: CIRCLE_ID }, user: owner }, res);
      await flush();
      expect(res.status).not.toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ deleted: true });
    });
  });

  describe('addMember', () => {
    test('403 when a non-owner tries to add a member', async () => {
      jest.spyOn(Circle, 'findById').mockResolvedValue(fakeCircle());
      const res = mockRes();
      controller.addMember(
        { params: { id: CIRCLE_ID }, body: { userId: NEW_MEMBER_ID }, user: stranger },
        res
      );
      await flush();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('400 for a missing or invalid userId', () => {
      const findById = jest.spyOn(Circle, 'findById');
      const res = mockRes();
      controller.addMember({ params: { id: CIRCLE_ID }, body: {}, user: owner }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(findById).not.toHaveBeenCalled();
    });

    test('400 when the target user is already a member', async () => {
      const circle = fakeCircle({ members: [{ user: MEMBER_ID, addedAt: new Date() }] });
      jest.spyOn(Circle, 'findById').mockResolvedValue(circle);
      const res = mockRes();
      controller.addMember(
        { params: { id: CIRCLE_ID }, body: { userId: MEMBER_ID }, user: owner },
        res
      );
      await flush();
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('400 when trying to add the owner as a member', async () => {
      jest.spyOn(Circle, 'findById').mockResolvedValue(fakeCircle());
      const res = mockRes();
      controller.addMember(
        { params: { id: CIRCLE_ID }, body: { userId: OWNER_ID }, user: owner },
        res
      );
      await flush();
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('400 when the circle is already at the member cap', async () => {
      const members = Array.from({ length: 200 }, (_, i) => ({ user: `id${i}`, addedAt: new Date() }));
      jest.spyOn(Circle, 'findById').mockResolvedValue(fakeCircle({ members }));
      const res = mockRes();
      controller.addMember(
        { params: { id: CIRCLE_ID }, body: { userId: NEW_MEMBER_ID }, user: owner },
        res
      );
      await flush();
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('404 when the target user does not exist', async () => {
      jest.spyOn(Circle, 'findById').mockResolvedValue(fakeCircle());
      jest.spyOn(User, 'findById').mockResolvedValue(null);
      const res = mockRes();
      controller.addMember(
        { params: { id: CIRCLE_ID }, body: { userId: NEW_MEMBER_ID }, user: owner },
        res
      );
      await flush();
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('adds the member atomically as pending — inviting someone never grants access on its own', async () => {
      jest.spyOn(Circle, 'findById').mockResolvedValue(fakeCircle());
      jest.spyOn(User, 'findById').mockResolvedValue({ _id: NEW_MEMBER_ID, username: 'jules' });
      const updated = fakeCircle({
        members: [{ user: NEW_MEMBER_ID, status: 'pending', addedAt: new Date() }],
      });
      const findOneAndUpdate = jest.spyOn(Circle, 'findOneAndUpdate').mockResolvedValue(updated);
      const res = mockRes();
      controller.addMember(
        { params: { id: CIRCLE_ID }, body: { userId: NEW_MEMBER_ID }, user: owner },
        res
      );
      await flush();
      expect(findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ _id: CIRCLE_ID, 'members.user': { $ne: NEW_MEMBER_ID } }),
        expect.objectContaining({
          $push: { members: expect.objectContaining({ user: NEW_MEMBER_ID, status: 'pending' }) },
        }),
        expect.objectContaining({ new: true })
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          circle: expect.objectContaining({
            members: [expect.objectContaining({ user: NEW_MEMBER_ID })],
          }),
        })
      );
    });

    test('creates an invite notification for the new member', async () => {
      jest.spyOn(Circle, 'findById').mockResolvedValue(fakeCircle());
      jest.spyOn(User, 'findById').mockResolvedValue({ _id: NEW_MEMBER_ID, username: 'jules' });
      const updated = fakeCircle({
        members: [{ user: NEW_MEMBER_ID, status: 'pending', addedAt: new Date() }],
      });
      jest.spyOn(Circle, 'findOneAndUpdate').mockResolvedValue(updated);
      const res = mockRes();
      controller.addMember(
        { params: { id: CIRCLE_ID }, body: { userId: NEW_MEMBER_ID }, user: owner },
        res
      );
      await flush();
      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient: NEW_MEMBER_ID,
          type: 'circle_invite',
          circle: CIRCLE_ID,
          circleName: 'The Sterling Family',
          actorUsername: 'pan',
        })
      );
    });

    test('still responds 201 when creating the invite notification fails', async () => {
      jest.spyOn(Circle, 'findById').mockResolvedValue(fakeCircle());
      jest.spyOn(User, 'findById').mockResolvedValue({ _id: NEW_MEMBER_ID, username: 'jules' });
      const updated = fakeCircle({
        members: [{ user: NEW_MEMBER_ID, status: 'pending', addedAt: new Date() }],
      });
      jest.spyOn(Circle, 'findOneAndUpdate').mockResolvedValue(updated);
      Notification.create.mockRejectedValue(new Error('db down'));
      const res = mockRes();
      controller.addMember(
        { params: { id: CIRCLE_ID }, body: { userId: NEW_MEMBER_ID }, user: owner },
        res
      );
      await flush();
      expect(res.status).toHaveBeenCalledWith(201);
    });

    test('a lost race (concurrent add already added the user) reports "already a member"', async () => {
      const initial = fakeCircle();
      const raceWinner = fakeCircle({ members: [{ user: NEW_MEMBER_ID, addedAt: new Date() }] });
      jest
        .spyOn(Circle, 'findById')
        .mockResolvedValueOnce(initial)
        .mockResolvedValueOnce(raceWinner);
      jest.spyOn(User, 'findById').mockResolvedValue({ _id: NEW_MEMBER_ID, username: 'jules' });
      jest.spyOn(Circle, 'findOneAndUpdate').mockResolvedValue(null);
      const res = mockRes();
      controller.addMember(
        { params: { id: CIRCLE_ID }, body: { userId: NEW_MEMBER_ID }, user: owner },
        res
      );
      await flush();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'user is already a member' });
    });

    test('a lost race where the cap filled up concurrently reports the cap error', async () => {
      const initial = fakeCircle();
      const fullMembers = Array.from({ length: 200 }, (_, i) => ({ user: `id${i}`, addedAt: new Date() }));
      const raceLoserState = fakeCircle({ members: fullMembers });
      jest
        .spyOn(Circle, 'findById')
        .mockResolvedValueOnce(initial)
        .mockResolvedValueOnce(raceLoserState);
      jest.spyOn(User, 'findById').mockResolvedValue({ _id: NEW_MEMBER_ID, username: 'jules' });
      jest.spyOn(Circle, 'findOneAndUpdate').mockResolvedValue(null);
      const res = mockRes();
      controller.addMember(
        { params: { id: CIRCLE_ID }, body: { userId: NEW_MEMBER_ID }, user: owner },
        res
      );
      await flush();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'a circle cannot have more than 200 members',
      });
    });
  });

  describe('removeMember', () => {
    test('a member can remove themselves', async () => {
      jest
        .spyOn(Circle, 'findById')
        .mockResolvedValue(fakeCircle({ members: [{ user: MEMBER_ID, addedAt: new Date() }] }));
      const findOneAndUpdate = jest
        .spyOn(Circle, 'findOneAndUpdate')
        .mockResolvedValue(fakeCircle({ members: [] }));
      const res = mockRes();
      controller.removeMember(
        { params: { id: CIRCLE_ID, userId: MEMBER_ID }, user: member },
        res
      );
      await flush();
      expect(findOneAndUpdate).toHaveBeenCalledWith(
        { _id: CIRCLE_ID },
        { $pull: { members: { user: MEMBER_ID } } },
        expect.objectContaining({ new: true })
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ circle: expect.objectContaining({ members: [] }) })
      );
    });

    test('the owner can remove any member', async () => {
      jest
        .spyOn(Circle, 'findById')
        .mockResolvedValue(fakeCircle({ members: [{ user: MEMBER_ID, addedAt: new Date() }] }));
      jest.spyOn(Circle, 'findOneAndUpdate').mockResolvedValue(fakeCircle({ members: [] }));
      const res = mockRes();
      controller.removeMember(
        { params: { id: CIRCLE_ID, userId: MEMBER_ID }, user: owner },
        res
      );
      await flush();
      expect(res.status).not.toHaveBeenCalledWith(403);
    });

    test('403 when a stranger tries to remove someone else', async () => {
      jest
        .spyOn(Circle, 'findById')
        .mockResolvedValue(fakeCircle({ members: [{ user: MEMBER_ID, addedAt: new Date() }] }));
      const findOneAndUpdate = jest.spyOn(Circle, 'findOneAndUpdate');
      const res = mockRes();
      controller.removeMember(
        { params: { id: CIRCLE_ID, userId: MEMBER_ID }, user: stranger },
        res
      );
      await flush();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(findOneAndUpdate).not.toHaveBeenCalled();
    });

    test('404 when the userId is not a member of the circle', async () => {
      jest.spyOn(Circle, 'findById').mockResolvedValue(fakeCircle({ members: [] }));
      const findOneAndUpdate = jest.spyOn(Circle, 'findOneAndUpdate');
      const res = mockRes();
      controller.removeMember(
        { params: { id: CIRCLE_ID, userId: MEMBER_ID }, user: owner },
        res
      );
      await flush();
      expect(res.status).toHaveBeenCalledWith(404);
      expect(findOneAndUpdate).not.toHaveBeenCalled();
    });

    test('404 (not a 500) when the circle is deleted by a concurrent request before the $pull lands', async () => {
      jest
        .spyOn(Circle, 'findById')
        .mockResolvedValue(fakeCircle({ members: [{ user: MEMBER_ID, addedAt: new Date() }] }));
      jest.spyOn(Circle, 'findOneAndUpdate').mockResolvedValue(null);
      const res = mockRes();
      controller.removeMember(
        { params: { id: CIRCLE_ID, userId: MEMBER_ID }, user: owner },
        res
      );
      await flush();
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('404 for a malformed userId, without touching the DB', () => {
      const findById = jest.spyOn(Circle, 'findById');
      const res = mockRes();
      controller.removeMember(
        { params: { id: CIRCLE_ID, userId: 'not-an-id' }, user: owner },
        res
      );
      expect(res.status).toHaveBeenCalledWith(404);
      expect(findById).not.toHaveBeenCalled();
    });

    test('marks the invite notification as read when the invitee declines a pending invite themselves', async () => {
      jest.spyOn(Circle, 'findById').mockResolvedValue(
        fakeCircle({ members: [{ user: MEMBER_ID, status: 'pending', addedAt: new Date() }] })
      );
      jest.spyOn(Circle, 'findOneAndUpdate').mockResolvedValue(fakeCircle({ members: [] }));
      const res = mockRes();
      controller.removeMember(
        { params: { id: CIRCLE_ID, userId: MEMBER_ID }, user: member },
        res
      );
      await flush();
      expect(Notification.updateMany).toHaveBeenCalledWith(
        { recipient: MEMBER_ID, circle: CIRCLE_ID, type: 'circle_invite', read: false },
        { $set: { read: true, readAt: expect.any(Date) } }
      );
    });

    test('does not touch notifications when an accepted member removes themselves (leaving, not declining)', async () => {
      jest.spyOn(Circle, 'findById').mockResolvedValue(
        fakeCircle({ members: [{ user: MEMBER_ID, status: 'accepted', addedAt: new Date() }] })
      );
      jest.spyOn(Circle, 'findOneAndUpdate').mockResolvedValue(fakeCircle({ members: [] }));
      const res = mockRes();
      controller.removeMember(
        { params: { id: CIRCLE_ID, userId: MEMBER_ID }, user: member },
        res
      );
      await flush();
      expect(Notification.updateMany).not.toHaveBeenCalled();
    });

    test('still responds 200 when marking the invite notification read fails on decline', async () => {
      jest.spyOn(Circle, 'findById').mockResolvedValue(
        fakeCircle({ members: [{ user: MEMBER_ID, status: 'pending', addedAt: new Date() }] })
      );
      jest.spyOn(Circle, 'findOneAndUpdate').mockResolvedValue(fakeCircle({ members: [] }));
      Notification.updateMany.mockRejectedValue(new Error('db down'));
      const res = mockRes();
      controller.removeMember(
        { params: { id: CIRCLE_ID, userId: MEMBER_ID }, user: member },
        res
      );
      await flush();
      expect(res.status).not.toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ circle: expect.objectContaining({ members: [] }) })
      );
    });

    test('marks the invite notification as read when the owner cancels a pending invite (not a self-decline)', async () => {
      jest.spyOn(Circle, 'findById').mockResolvedValue(
        fakeCircle({ members: [{ user: MEMBER_ID, status: 'pending', addedAt: new Date() }] })
      );
      jest.spyOn(Circle, 'findOneAndUpdate').mockResolvedValue(fakeCircle({ members: [] }));
      const res = mockRes();
      controller.removeMember(
        { params: { id: CIRCLE_ID, userId: MEMBER_ID }, user: owner },
        res
      );
      await flush();
      expect(Notification.updateMany).toHaveBeenCalledWith(
        { recipient: MEMBER_ID, circle: CIRCLE_ID, type: 'circle_invite', read: false },
        { $set: { read: true, readAt: expect.any(Date) } }
      );
    });
  });

  describe('listInvites', () => {
    test("returns the requester's pending invitations as a slim summary (no member list)", async () => {
      const find = jest.spyOn(Circle, 'find').mockReturnValue(mockCircleQuery([fakeCircle()]));
      jest.spyOn(Circle, 'countDocuments').mockResolvedValue(1);
      jest.spyOn(User, 'find').mockResolvedValue([{ _id: OWNER_ID, username: 'pan' }]);
      const res = mockRes();
      controller.listInvites({ user: member, query: {} }, res);
      await flush();

      expect(find).toHaveBeenCalledWith({
        members: { $elemMatch: { user: MEMBER_ID, status: 'pending' } },
      });
      expect(res.json).toHaveBeenCalledWith({
        invites: [
          {
            _id: CIRCLE_ID,
            name: 'The Sterling Family',
            description: '',
            ownerUsername: 'pan',
          },
        ],
        total: 1,
        page: 1,
        limit: 12,
      });
    });

    test('returns 500 when the query fails', async () => {
      jest.spyOn(Circle, 'find').mockReturnValue(mockCircleQuery([]));
      jest.spyOn(Circle, 'countDocuments').mockRejectedValue(new Error('x'));
      const res = mockRes();
      controller.listInvites({ user: member, query: {} }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('respondToInvite', () => {
    test('404 for a malformed circle id', () => {
      const findOneAndUpdate = jest.spyOn(Circle, 'findOneAndUpdate');
      const res = mockRes();
      controller.respondToInvite(
        { params: { id: 'not-an-id', userId: MEMBER_ID }, body: { status: 'accepted' }, user: member },
        res
      );
      expect(res.status).toHaveBeenCalledWith(404);
      expect(findOneAndUpdate).not.toHaveBeenCalled();
    });

    test('404 for a malformed userId, without touching the DB', () => {
      const findOneAndUpdate = jest.spyOn(Circle, 'findOneAndUpdate');
      const res = mockRes();
      controller.respondToInvite(
        { params: { id: CIRCLE_ID, userId: 'not-an-id' }, body: { status: 'accepted' }, user: member },
        res
      );
      expect(res.status).toHaveBeenCalledWith(404);
      expect(findOneAndUpdate).not.toHaveBeenCalled();
    });

    test('400 for any status other than accepted', () => {
      const findOneAndUpdate = jest.spyOn(Circle, 'findOneAndUpdate');
      const res = mockRes();
      controller.respondToInvite(
        { params: { id: CIRCLE_ID, userId: MEMBER_ID }, body: { status: 'declined' }, user: member },
        res
      );
      expect(res.status).toHaveBeenCalledWith(400);
      expect(findOneAndUpdate).not.toHaveBeenCalled();
    });

    test('403 when responding to someone else\'s invitation', () => {
      const findOneAndUpdate = jest.spyOn(Circle, 'findOneAndUpdate');
      const res = mockRes();
      controller.respondToInvite(
        { params: { id: CIRCLE_ID, userId: MEMBER_ID }, body: { status: 'accepted' }, user: stranger },
        res
      );
      expect(res.status).toHaveBeenCalledWith(403);
      expect(findOneAndUpdate).not.toHaveBeenCalled();
    });

    test('404 when there is no matching pending invitation', async () => {
      const findOneAndUpdate = jest.spyOn(Circle, 'findOneAndUpdate').mockResolvedValue(null);
      const res = mockRes();
      controller.respondToInvite(
        { params: { id: CIRCLE_ID, userId: MEMBER_ID }, body: { status: 'accepted' }, user: member },
        res
      );
      await flush();
      expect(findOneAndUpdate).toHaveBeenCalledWith(
        { _id: CIRCLE_ID, 'members.user': MEMBER_ID },
        { $set: { 'members.$.status': 'accepted' } },
        expect.objectContaining({ new: true })
      );
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('accepts the invitation and returns the updated circle', async () => {
      const updated = fakeCircle({
        members: [{ user: MEMBER_ID, status: 'accepted', addedAt: new Date() }],
      });
      jest.spyOn(Circle, 'findOneAndUpdate').mockResolvedValue(updated);
      const res = mockRes();
      controller.respondToInvite(
        { params: { id: CIRCLE_ID, userId: MEMBER_ID }, body: { status: 'accepted' }, user: member },
        res
      );
      await flush();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          circle: expect.objectContaining({
            members: [expect.objectContaining({ status: 'accepted' })],
          }),
        })
      );
    });

    test('marks the matching invite notification as read on acceptance', async () => {
      const updated = fakeCircle({
        members: [{ user: MEMBER_ID, status: 'accepted', addedAt: new Date() }],
      });
      jest.spyOn(Circle, 'findOneAndUpdate').mockResolvedValue(updated);
      const res = mockRes();
      controller.respondToInvite(
        { params: { id: CIRCLE_ID, userId: MEMBER_ID }, body: { status: 'accepted' }, user: member },
        res
      );
      await flush();
      expect(Notification.updateMany).toHaveBeenCalledWith(
        { recipient: MEMBER_ID, circle: CIRCLE_ID, type: 'circle_invite', read: false },
        { $set: { read: true, readAt: expect.any(Date) } }
      );
    });

    test('still responds 200 when marking the invite notification read fails on acceptance', async () => {
      const updated = fakeCircle({
        members: [{ user: MEMBER_ID, status: 'accepted', addedAt: new Date() }],
      });
      jest.spyOn(Circle, 'findOneAndUpdate').mockResolvedValue(updated);
      Notification.updateMany.mockRejectedValue(new Error('db down'));
      const res = mockRes();
      controller.respondToInvite(
        { params: { id: CIRCLE_ID, userId: MEMBER_ID }, body: { status: 'accepted' }, user: member },
        res
      );
      await flush();
      expect(res.status).not.toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          circle: expect.objectContaining({
            members: [expect.objectContaining({ status: 'accepted' })],
          }),
        })
      );
    });
  });
});
