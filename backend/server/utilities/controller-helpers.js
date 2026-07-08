const Circle = require('../data/Circle');

// A 'shared' album with no circle attached keeps the legacy behavior of
// being open to any authenticated user. Once a circle is attached, access
// narrows to that circle's owner and members. A dangling reference (the
// circle was deleted) is treated as "no access" rather than throwing.
function canAccessSharedAlbum(album, user) {
  if (!album.sharedWithCircle) return Promise.resolve(true);

  return Circle.findById(album.sharedWithCircle).then((circle) => {
    if (!circle) return false;
    return circle.isOwnerOrMember(user._id);
  });
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
};
