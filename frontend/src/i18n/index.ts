import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enCommon from '../locales/en/common.json';
import bgCommon from '../locales/bg/common.json';
import enSettings from '../locales/en/settings.json';
import bgSettings from '../locales/bg/settings.json';
import enAuth from '../locales/en/auth.json';
import bgAuth from '../locales/bg/auth.json';
import enProfile from '../locales/en/profile.json';
import bgProfile from '../locales/bg/profile.json';
import enCircles from '../locales/en/circles.json';
import bgCircles from '../locales/bg/circles.json';
import enFlipbooks from '../locales/en/flipbooks.json';
import bgFlipbooks from '../locales/bg/flipbooks.json';
import enSocial from '../locales/en/social.json';
import bgSocial from '../locales/bg/social.json';
import enViewer from '../locales/en/viewer.json';
import bgViewer from '../locales/bg/viewer.json';
import enEditor from '../locales/en/editor.json';
import bgEditor from '../locales/bg/editor.json';
import enExplore from '../locales/en/explore.json';
import bgExplore from '../locales/bg/explore.json';
import enArchive from '../locales/en/archive.json';
import bgArchive from '../locales/bg/archive.json';
import enNotifications from '../locales/en/notifications.json';
import bgNotifications from '../locales/bg/notifications.json';
import enLanding from '../locales/en/landing.json';
import bgLanding from '../locales/bg/landing.json';

export const LANGUAGE_STORAGE_KEY = 'folia_language';

void i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: enCommon,
        settings: enSettings,
        auth: enAuth,
        profile: enProfile,
        circles: enCircles,
        flipbooks: enFlipbooks,
        social: enSocial,
        viewer: enViewer,
        editor: enEditor,
        explore: enExplore,
        archive: enArchive,
        notifications: enNotifications,
        landing: enLanding,
      },
      bg: {
        common: bgCommon,
        settings: bgSettings,
        auth: bgAuth,
        profile: bgProfile,
        circles: bgCircles,
        flipbooks: bgFlipbooks,
        social: bgSocial,
        viewer: bgViewer,
        editor: bgEditor,
        explore: bgExplore,
        archive: bgArchive,
        notifications: bgNotifications,
        landing: bgLanding,
      },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'bg'],
    ns: [
      'common',
      'settings',
      'auth',
      'profile',
      'circles',
      'flipbooks',
      'social',
      'viewer',
      'editor',
      'explore',
      'archive',
      'notifications',
      'landing',
    ],
    defaultNS: 'common',
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
    },
    interpolation: {
      escapeValue: false,
    },
    debug: import.meta.env.DEV,
  });

i18next.on('languageChanged', (language) => {
  document.documentElement.lang = language;
});

export default i18next;
