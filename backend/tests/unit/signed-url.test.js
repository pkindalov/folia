const signedUrl = require('../../server/utilities/signed-url');

describe('signed-url utility', () => {
  test('sign appends an exp and sig query string to the given path', () => {
    const signed = signedUrl.sign('/uploads/owner1/album1/photo.jpg');
    expect(signed).toMatch(/^\/uploads\/owner1\/album1\/photo\.jpg\?exp=\d+&sig=[0-9a-f]+$/);
  });

  test('verify accepts a signature freshly minted by sign', () => {
    const signed = signedUrl.sign('/uploads/owner1/album1/photo.jpg');
    const url = new URL(signed, 'http://localhost');
    const pathname = url.pathname;
    const exp = url.searchParams.get('exp');
    const sig = url.searchParams.get('sig');
    expect(signedUrl.verify(pathname, exp, sig)).toBe(true);
  });

  test('verify rejects a tampered path (signature no longer matches)', () => {
    const signed = signedUrl.sign('/uploads/owner1/album1/photo.jpg');
    const url = new URL(signed, 'http://localhost');
    expect(
      signedUrl.verify('/uploads/owner1/album1/other.jpg', url.searchParams.get('exp'), url.searchParams.get('sig'))
    ).toBe(false);
  });

  test('verify rejects a tampered signature', () => {
    const signed = signedUrl.sign('/uploads/owner1/album1/photo.jpg');
    const url = new URL(signed, 'http://localhost');
    const tamperedSig = url.searchParams.get('sig').split('').reverse().join('');
    expect(signedUrl.verify(url.pathname, url.searchParams.get('exp'), tamperedSig)).toBe(false);
  });

  test('verify rejects an expired signature', () => {
    const signed = signedUrl.sign('/uploads/owner1/album1/photo.jpg', -1000);
    const url = new URL(signed, 'http://localhost');
    expect(signedUrl.verify(url.pathname, url.searchParams.get('exp'), url.searchParams.get('sig'))).toBe(
      false
    );
  });

  test('verify rejects a signature minted for a different path, even with a valid exp/sig pairing', () => {
    const signedA = signedUrl.sign('/uploads/owner1/album1/a.jpg');
    const signedB = signedUrl.sign('/uploads/owner1/album1/b.jpg');
    const urlA = new URL(signedA, 'http://localhost');
    const urlB = new URL(signedB, 'http://localhost');
    expect(signedUrl.verify(urlB.pathname, urlA.searchParams.get('exp'), urlA.searchParams.get('sig'))).toBe(
      false
    );
  });

  test('verify rejects when exp or sig is missing', () => {
    expect(signedUrl.verify('/uploads/owner1/album1/photo.jpg', undefined, undefined)).toBe(false);
    expect(signedUrl.verify('/uploads/owner1/album1/photo.jpg', '9999999999999', undefined)).toBe(false);
  });

  test('verify rejects a non-string signature (e.g. a duplicated query param parsed as an array)', () => {
    const signed = signedUrl.sign('/uploads/owner1/album1/photo.jpg');
    const url = new URL(signed, 'http://localhost');
    expect(signedUrl.verify(url.pathname, url.searchParams.get('exp'), ['a', 'b'])).toBe(false);
  });

  test('verify rejects a non-numeric exp', () => {
    const signed = signedUrl.sign('/uploads/owner1/album1/photo.jpg');
    const url = new URL(signed, 'http://localhost');
    expect(signedUrl.verify(url.pathname, 'not-a-number', url.searchParams.get('sig'))).toBe(false);
  });
});
