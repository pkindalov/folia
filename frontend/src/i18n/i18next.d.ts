import 'i18next';

import common from '../locales/en/common.json';
import settings from '../locales/en/settings.json';
import auth from '../locales/en/auth.json';
import profile from '../locales/en/profile.json';
import circles from '../locales/en/circles.json';
import flipbooks from '../locales/en/flipbooks.json';
import social from '../locales/en/social.json';
import viewer from '../locales/en/viewer.json';
import editor from '../locales/en/editor.json';
import explore from '../locales/en/explore.json';
import archive from '../locales/en/archive.json';
import notifications from '../locales/en/notifications.json';
import landing from '../locales/en/landing.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof common;
      settings: typeof settings;
      auth: typeof auth;
      profile: typeof profile;
      circles: typeof circles;
      flipbooks: typeof flipbooks;
      social: typeof social;
      viewer: typeof viewer;
      editor: typeof editor;
      explore: typeof explore;
      archive: typeof archive;
      notifications: typeof notifications;
      landing: typeof landing;
    };
  }
}
