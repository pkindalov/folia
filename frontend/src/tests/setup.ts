import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import i18next from '../i18n';

afterEach(async () => {
  cleanup();
  localStorage.clear();
  await i18next.changeLanguage('en');
});
