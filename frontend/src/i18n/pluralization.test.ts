import { describe, test, expect } from 'vitest';
import i18next from './index';

describe('notificationsUnread pluralization', () => {
  test('uses the singular form for a count of 1 in each supported language', () => {
    expect(i18next.getFixedT('en', 'notifications')('bell.notificationsUnread', { count: 1 })).toBe(
      'Notifications, 1 unread'
    );
    expect(i18next.getFixedT('bg', 'notifications')('bell.notificationsUnread', { count: 1 })).toBe(
      'Известия, 1 непрочетено'
    );
  });

  test('uses the plural form for a count greater than 1 in each supported language', () => {
    expect(i18next.getFixedT('en', 'notifications')('bell.notificationsUnread', { count: 5 })).toBe(
      'Notifications, 5 unread'
    );
    expect(i18next.getFixedT('bg', 'notifications')('bell.notificationsUnread', { count: 5 })).toBe(
      'Известия, 5 непрочетени'
    );
  });
});

describe('circles memberCount pluralization', () => {
  test('uses the singular form for a count of 1 in each supported language', () => {
    expect(i18next.getFixedT('en', 'circles')('circlesPage.memberCount', { count: 1 })).toBe('1 member');
    expect(i18next.getFixedT('bg', 'circles')('circlesPage.memberCount', { count: 1 })).toBe('1 член');
  });

  test('uses the plural form for a count greater than 1 in each supported language', () => {
    expect(i18next.getFixedT('en', 'circles')('circlesPage.memberCount', { count: 3 })).toBe('3 members');
    expect(i18next.getFixedT('bg', 'circles')('circlesPage.memberCount', { count: 3 })).toBe('3 члена');
  });
});

describe('circles memberHeading pluralization', () => {
  test('uses the singular form for a count of 1 in each supported language', () => {
    expect(i18next.getFixedT('en', 'circles')('circleDetail.memberHeading', { count: 1 })).toBe('1 Member');
    expect(i18next.getFixedT('bg', 'circles')('circleDetail.memberHeading', { count: 1 })).toBe('1 член');
  });

  test('uses the plural form for a count greater than 1 in each supported language', () => {
    expect(i18next.getFixedT('en', 'circles')('circleDetail.memberHeading', { count: 4 })).toBe('4 Members');
    expect(i18next.getFixedT('bg', 'circles')('circleDetail.memberHeading', { count: 4 })).toBe('4 члена');
  });
});

describe('flipbooks pageCount pluralization', () => {
  test('uses the singular form for a count of 1 in each supported language', () => {
    expect(i18next.getFixedT('en', 'flipbooks')('myFlipbooksPage.pageCount', { count: 1 })).toBe('1 page');
    expect(i18next.getFixedT('bg', 'flipbooks')('myFlipbooksPage.pageCount', { count: 1 })).toBe('1 страница');
  });

  test('uses the plural form for a count greater than 1 in each supported language', () => {
    expect(i18next.getFixedT('en', 'flipbooks')('myFlipbooksPage.pageCount', { count: 7 })).toBe('7 pages');
    expect(i18next.getFixedT('bg', 'flipbooks')('myFlipbooksPage.pageCount', { count: 7 })).toBe('7 страници');
  });
});

describe('editor pagesPanel pageCount pluralization', () => {
  test('uses the singular form for a count of 1 in each supported language', () => {
    expect(i18next.getFixedT('en', 'editor')('pagesPanel.pageCount', { count: 1 })).toBe('1 page');
    expect(i18next.getFixedT('bg', 'editor')('pagesPanel.pageCount', { count: 1 })).toBe('1 страница');
  });

  test('uses the plural form for a count greater than 1 in each supported language', () => {
    expect(i18next.getFixedT('en', 'editor')('pagesPanel.pageCount', { count: 2 })).toBe('2 pages');
    expect(i18next.getFixedT('bg', 'editor')('pagesPanel.pageCount', { count: 2 })).toBe('2 страници');
  });
});

describe('editor addedPhotos pluralization', () => {
  test('uses the singular form for a count of 1 in each supported language', () => {
    expect(i18next.getFixedT('en', 'editor')('addedPhotos', { count: 1 })).toBe('Added 1 photo.');
    expect(i18next.getFixedT('bg', 'editor')('addedPhotos', { count: 1 })).toBe('Добавена е 1 снимка.');
  });

  test('uses the plural form for a count greater than 1 in each supported language', () => {
    expect(i18next.getFixedT('en', 'editor')('addedPhotos', { count: 3 })).toBe('Added 3 photos.');
    expect(i18next.getFixedT('bg', 'editor')('addedPhotos', { count: 3 })).toBe('Добавени са 3 снимки.');
  });
});

describe('editor rejection count pluralization', () => {
  test('tooLargeCount uses the singular form for a count of 1 and plural for more', () => {
    expect(i18next.getFixedT('en', 'editor')('rejections.tooLargeCount', { count: 1 })).toBe(
      '1 was too large (max 10MB)'
    );
    expect(i18next.getFixedT('en', 'editor')('rejections.tooLargeCount', { count: 2 })).toBe(
      '2 were too large (max 10MB)'
    );
    expect(i18next.getFixedT('bg', 'editor')('rejections.tooLargeCount', { count: 1 })).toBe(
      '1 беше твърде голяма (макс. 10MB)'
    );
    expect(i18next.getFixedT('bg', 'editor')('rejections.tooLargeCount', { count: 2 })).toBe(
      '2 бяха твърде големи (макс. 10MB)'
    );
  });

  test('wrongTypeCount uses the singular form for a count of 1 and plural for more', () => {
    expect(i18next.getFixedT('en', 'editor')('rejections.wrongTypeCount', { count: 1 })).toBe(
      '1 has an unsupported format (only JPEG, PNG, WEBP, GIF)'
    );
    expect(i18next.getFixedT('en', 'editor')('rejections.wrongTypeCount', { count: 2 })).toBe(
      '2 have an unsupported format (only JPEG, PNG, WEBP, GIF)'
    );
    expect(i18next.getFixedT('bg', 'editor')('rejections.wrongTypeCount', { count: 1 })).toBe(
      '1 е с неподдържан формат (само JPEG, PNG, WEBP, GIF)'
    );
    expect(i18next.getFixedT('bg', 'editor')('rejections.wrongTypeCount', { count: 2 })).toBe(
      '2 са с неподдържан формат (само JPEG, PNG, WEBP, GIF)'
    );
  });

  test('summary uses the singular form for a count of 1 and plural for more', () => {
    expect(
      i18next.getFixedT('en', 'editor')('rejections.summary', { count: 1, details: 'x.png was too large' })
    ).toBe("1 photo wasn't added: x.png was too large.");
    expect(
      i18next.getFixedT('en', 'editor')('rejections.summary', { count: 2, details: 'x.png, y.png were too large' })
    ).toBe("2 photos weren't added: x.png, y.png were too large.");
    expect(
      i18next.getFixedT('bg', 'editor')('rejections.summary', { count: 1, details: 'x.png беше твърде голяма' })
    ).toBe('1 снимка не беше добавена: x.png беше твърде голяма.');
    expect(
      i18next.getFixedT('bg', 'editor')('rejections.summary', {
        count: 2,
        details: 'x.png, y.png бяха твърде големи',
      })
    ).toBe('2 снимки не бяха добавени: x.png, y.png бяха твърде големи.');
  });
});
