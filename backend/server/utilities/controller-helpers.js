const Circle = require('../data/Circle');

// A 'shared' album with no circle attached keeps the legacy behavior of
// being open to any authenticated user. Once a circle is attached, access
// narrows to that circle's owner and members. A dangling reference (the
// circle was deleted) is treated as "no access" rather than throwing.
// Intentionally reachable only via direct link — no listing endpoint
// surfaces these albums to other users, by design.
function canAccessSharedAlbum(album, user) {
  if (!album.sharedWithCircle) return Promise.resolve(true);

  return Circle.findById(album.sharedWithCircle).then((circle) => {
    if (!circle) return false;
    return circle.isOwnerOrMember(user._id);
  });
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
function checkAlbumReadAccess(album, user) {
  if (isOwnerOrAdmin(album, user)) return Promise.resolve(null);

  if (album.visibility === 'private') {
    return Promise.resolve({ status: 403, error: 'This album is private' });
  }
  if (album.visibility === 'shared') {
    return canAccessSharedAlbum(album, user).then((allowed) =>
      allowed ? null : { status: 403, error: 'This album is shared with a specific circle' }
    );
  }
  return Promise.resolve(null);
}

module.exports = {
  isNonEmptyString: (v) => typeof v === 'string' && v.trim().length > 0,

  // Page size is fixed server-side — only the page number is caller-controlled,
  // so a client can't request an unbounded page of results.
  parsePage: (query) => {
    const page = parseInt(query?.page, 10);
    return Number.isInteger(page) && page > 0 ? page : 1;
  },

  // Shown in place of a username when the referenced User document no longer
  // exists — keeps the response shape valid instead of omitting the field.
  DELETED_USER_LABEL: 'Deleted user',

  canAccessSharedAlbum,
  isOwnerOrAdmin,
  checkAlbumReadAccess,
};
