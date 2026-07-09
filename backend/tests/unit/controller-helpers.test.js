const { parsePage } = require('../../server/utilities/controller-helpers');

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
