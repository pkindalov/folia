const Circle = require('../data/Circle');
const User = require('../data/User');

const DELETED_USER_LABEL = 'Deleted user';

// Resolves an array of user ObjectIds to their current usernames, in the
// same order as the input — one batched query instead of one lookup per id.
// Falls back to DELETED_USER_LABEL for a user account that no longer exists
// (mirrors withOwnerUsernamesAndCovers's fallback in albums-controller.js).
// Shared by pages-controller.js and album-reactions.js so "who reacted"
// resolves usernames the same way in both places.
function resolveUsernames(userIds) {
  const uniqueIds = [...new Set(userIds.map((id) => id.toString()))];
  if (uniqueIds.length === 0) return Promise.resolve([]);

  return User.find({ _id: { $in: uniqueIds } }, 'username').then((users) => {
    const usernameById = new Map(users.map((user) => [user._id.toString(), user.username]));
    return userIds.map((id) => usernameById.get(id.toString()) ?? DELETED_USER_LABEL);
  });
}

// A 'shared' album with no circle attached keeps the legacy behavior of
// being open to any authenticated user. Once a circle is attached, access
// narrows to that circle's owner and members. A dangling reference (the
// circle was deleted) is treated as "no access" rather than throwing.
// Intentionally reachable only via direct link — no listing endpoint
// surfaces these albums to other users, by design.
//
// `circleById`, if given, is used instead of a fresh Circle.findById — lets
// a caller checking many albums at once (see fetchCirclesForAlbums) pass in
// a single pre-fetched batch instead of one query per album.
function canAccessSharedAlbum(album, user, circleById) {
  if (!album.sharedWithCircle) return Promise.resolve(true);

  if (circleById) {
    const circle = circleById.get(album.sharedWithCircle.toString());
    return Promise.resolve(circle ? circle.isOwnerOrMember(user._id) : false);
  }

  return Circle.findById(album.sharedWithCircle).then((circle) => {
    if (!circle) return false;
    return circle.isOwnerOrMember(user._id);
  });
}

// Pre-fetches every distinct circle referenced by a list of albums in a
// single query, for callers that run checkAlbumReadAccess across many
// albums at once (e.g. resolving notification thumbnails) and would
// otherwise issue one Circle.findById per shared album.
function fetchCirclesForAlbums(albums) {
  const circleIds = [
    ...new Set(albums.filter((album) => album.sharedWithCircle).map((album) => album.sharedWithCircle.toString())),
  ];
  if (circleIds.length === 0) return Promise.resolve(new Map());

  return Circle.find({ _id: { $in: circleIds } }).then(
    (circles) => new Map(circles.map((circle) => [circle._id.toString(), circle]))
  );
}

// Shared by every controller that gates a mutation behind ownership of an
// `owner`-bearing resource (an album or a circle) — kept as one definition
// so a future edit to one controller's copy can't silently diverge from the
// others and reopen an access-control hole (see the authorization bypass
// fixed in commit d2a602a).
function isOwnerOrAdmin(resource, user) {
  return resource.owner.toString() === user._id.toString() || user.roles.includes('Admin');
}

// Resolves to null when `user` may read `album` (its owner/an Admin, a
// public album, an unrestricted 'shared' album, or an accepted member of
// the circle it's restricted to), or a { status, error } response
// descriptor when they may not. Shared between the albums and pages
// controllers so "who can read an album" can't drift between the two.
function checkAlbumReadAccess(album, user, circleById) {
  if (isOwnerOrAdmin(album, user)) return Promise.resolve(null);

  if (album.visibility === 'private') {
    return Promise.resolve({ status: 403, error: 'This album is private' });
  }
  if (album.visibility === 'shared') {
    return canAccessSharedAlbum(album, user, circleById).then((allowed) =>
      allowed ? null : { status: 403, error: 'This album is shared with a specific circle' }
    );
  }
  return Promise.resolve(null);
}

// Caps how far a caller can page in, so an arbitrarily large page number
// can't force a huge, wasteful .skip() on the underlying query.
const MAX_PAGE = 100000;

// Who should be notified about something happening on a circle (its
// deletion) or on a resource shared with it (an album being shared, edited,
// deleted, or getting new photos): the circle's owner plus its accepted
// members — mirroring exactly who canAccessSharedAlbum/isOwnerOrMember
// already grant access to — minus whoever performed the action, since they
// don't need telling about their own action. Shared by circles-controller.js
// and album-notifications.js so the recipient rule can't drift between them.
function circleRecipientIds(circle, actorId) {
  const excludeId = actorId.toString();
  return [
    ...new Set([
      circle.owner.toString(),
      ...circle.members
        .filter((member) => member.status === 'accepted')
        .map((member) => member.user.toString()),
    ]),
  ].filter((recipientId) => recipientId !== excludeId);
}

module.exports = {
  isNonEmptyString: (v) => typeof v === 'string' && v.trim().length > 0,

  // Page size is fixed server-side — only the page number is caller-controlled,
  // so a client can't request an unbounded page of results.
  parsePage: (query) => {
    const page = parseInt(query?.page, 10);
    if (!Number.isInteger(page) || page < 1) return 1;
    return Math.min(page, MAX_PAGE);
  },

  // Shown in place of a username when the referenced User document no longer
  // exists — keeps the response shape valid instead of omitting the field.
  DELETED_USER_LABEL,

  canAccessSharedAlbum,
  fetchCirclesForAlbums,
  isOwnerOrAdmin,
  checkAlbumReadAccess,
  circleRecipientIds,
  resolveUsernames,
};
