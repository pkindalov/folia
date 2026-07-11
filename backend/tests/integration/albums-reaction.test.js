const request = require('supertest');

const OWNER_ID = '507f1f77bcf86cd799439011';
const OTHER_ID = '507f1f77bcf86cd799439022';
const ALBUM_ID = '507f191e810c19729de860ea';

describe('PUT /api/albums/:id/reaction (integration)', () => {
  let app;
  let User;
  let Album;
  let Circle;
  let AlbumReaction;
  let Notification;
  let auth;
  let token;
  let strangerToken;

  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    User = require('../../server/data/User');
    Album = require('../../server/data/Album');
    Circle = require('../../server/data/Circle');
    AlbumReaction = require('../../server/data/AlbumReaction');
    Notification = require('../../server/data/Notification');
    auth = require('../../server/config/auth');

    const express = require('express');
    app = express();
    require('../../server/config/express')(app);
    require('../../server/config/routes')(app);

    token = auth.signToken({ _id: OWNER_ID, username: 'pan' });
    strangerToken = auth.signToken({ _id: OTHER_ID, username: 'maria' });
  });

  const fakeAlbum = (overrides = {}) => ({
    _id: ALBUM_ID,
    title: 'Summer',
    visibility: 'private',
    owner: OWNER_ID,
    ...overrides,
  });

  const authAs = (id, roles = ['User']) => {
    jest.spyOn(User, 'findById').mockResolvedValue({ _id: id, username: 'pan', roles });
  };

  // resolveAlbumReactionSummary chains AlbumReaction.find(...).sort().limit()
  // — a thenable with sort/limit no-ops satisfies that chain.
  const mockReactorQuery = (docs) => {
    const query = Promise.resolve(docs);
    query.sort = () => query;
    query.limit = () => query;
    return query;
  };

  beforeEach(() => {
    jest.spyOn(Notification, 'create').mockResolvedValue({ _id: 'notif1' });
    jest.spyOn(Notification, 'pruneExcessForRecipient').mockResolvedValue(null);
    jest.spyOn(AlbumReaction, 'countDocuments').mockResolvedValue(0);
    jest.spyOn(AlbumReaction, 'exists').mockResolvedValue(null);
    jest.spyOn(AlbumReaction, 'find').mockImplementation(() => mockReactorQuery([]));
    jest.spyOn(Album, 'exists').mockResolvedValue(true);
  });

  test('401 without a token', async () => {
    const res = await request(app).put(`/api/albums/${ALBUM_ID}/reaction`);
    expect(res.status).toBe(401);
  });

  test('403 when a stranger reacts to a private album', async () => {
    authAs(OTHER_ID);
    jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
    const res = await request(app)
      .put(`/api/albums/${ALBUM_ID}/reaction`)
      .set('Authorization', `Bearer ${strangerToken}`);
    expect(res.status).toBe(403);
  });

  test('a circle member can love a shared album, and the owner is notified', async () => {
    authAs(OTHER_ID);
    const album = fakeAlbum({ visibility: 'shared', sharedWithCircle: '507f1f77bcf86cd799439099' });
    jest.spyOn(Album, 'findById').mockResolvedValue(album);
    jest.spyOn(Circle, 'findById').mockResolvedValue(
      new Circle({
        name: 'Family',
        owner: OWNER_ID,
        members: [{ user: OTHER_ID, status: 'accepted' }],
      })
    );
    jest.spyOn(AlbumReaction, 'findOne').mockResolvedValue(null);
    jest.spyOn(AlbumReaction, 'create').mockResolvedValue({});
    jest.spyOn(AlbumReaction, 'countDocuments').mockResolvedValue(1);
    jest.spyOn(AlbumReaction, 'exists').mockResolvedValue({ _id: 'r1' });

    const res = await request(app)
      .put(`/api/albums/${ALBUM_ID}/reaction`)
      .set('Authorization', `Bearer ${strangerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ reactions: { total: 1, viewerReacted: true, reactors: [] } });
    expect(Notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ recipient: OWNER_ID, type: 'album_reaction' })
    );
  });

  test('loving the album twice removes the reaction (toggle-off), and does not notify', async () => {
    authAs(OWNER_ID);
    jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
    const deleteOne = jest.fn().mockResolvedValue({});
    jest.spyOn(AlbumReaction, 'findOne').mockResolvedValue({ deleteOne });

    const res = await request(app)
      .put(`/api/albums/${ALBUM_ID}/reaction`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(deleteOne).toHaveBeenCalled();
    expect(Notification.create).not.toHaveBeenCalled();
  });

  test('404s and does not notify when the album was deleted by a concurrent request', async () => {
    authAs(OWNER_ID);
    jest.spyOn(Album, 'findById').mockResolvedValue(fakeAlbum());
    jest.spyOn(Album, 'exists').mockResolvedValue(null);
    const findOne = jest.spyOn(AlbumReaction, 'findOne');

    const res = await request(app)
      .put(`/api/albums/${ALBUM_ID}/reaction`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(findOne).not.toHaveBeenCalled();
    expect(Notification.create).not.toHaveBeenCalled();
  });
});
