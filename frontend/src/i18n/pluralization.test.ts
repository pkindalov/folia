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
