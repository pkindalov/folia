const fs = require('fs');
const os = require('os');
const path = require('path');

describe('storage utility', () => {
  let tmpRoot;
  let storage;

  beforeAll(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'folia-uploads-'));
    process.env.UPLOADS_DIR = tmpRoot;
    jest.isolateModules(() => {
      storage = require('../../server/utilities/storage');
    });
  });

  afterAll(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    delete process.env.UPLOADS_DIR;
  });

  test('albumDir nests album folder inside the owner folder', () => {
    const dir = storage.albumDir('user1', 'album1');
    expect(dir).toBe(path.resolve(tmpRoot, 'user1', 'album1'));
  });

  test('ensureAlbumDir creates the folder recursively', () => {
    const dir = storage.ensureAlbumDir('user1', 'album1');
    expect(fs.existsSync(dir)).toBe(true);
  });

  test('ensureAlbumDir is idempotent', () => {
    storage.ensureAlbumDir('user1', 'album1');
    expect(() => storage.ensureAlbumDir('user1', 'album1')).not.toThrow();
  });

  test('removeAlbumDir deletes the folder and its contents', () => {
    const dir = storage.ensureAlbumDir('user2', 'album9');
    fs.writeFileSync(path.join(dir, 'photo.jpg'), 'fake');
    storage.removeAlbumDir('user2', 'album9');
    expect(fs.existsSync(dir)).toBe(false);
    // the user's folder itself remains
    expect(fs.existsSync(path.resolve(tmpRoot, 'user2'))).toBe(true);
  });

  test('removeAlbumDir tolerates a folder that never existed', () => {
    expect(() => storage.removeAlbumDir('ghost', 'nothing')).not.toThrow();
  });

  test('photoPath resolves inside the album\'s own folder', () => {
    const path = storage.photoPath('user1', 'album1', 'abc.jpg');
    expect(path).toBe(require('path').join(storage.albumDir('user1', 'album1'), 'abc.jpg'));
  });
});
