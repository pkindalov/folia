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
};
