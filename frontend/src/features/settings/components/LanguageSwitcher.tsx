import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '../../../i18n/languages';

export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation('settings');
  const activeLanguage = i18n.resolvedLanguage ?? i18n.language;

  return (
    <section className="bg-surface-container-lowest rounded-card p-8 border border-outline-variant mb-8">
      <h3 className="font-display text-headline-sm text-primary mb-2">{t('language.title')}</h3>
      <p className="font-body text-on-surface-variant mb-6">{t('language.description')}</p>
      <div className="flex gap-3">
        {SUPPORTED_LANGUAGES.map(({ code, label }) => (
          <button
            key={code}
            type="button"
            onClick={() => void i18n.changeLanguage(code)}
            aria-pressed={activeLanguage === code}
            className={`font-ui text-ui-label uppercase px-4 py-3 rounded-paper border transition-colors ${
              activeLanguage === code
                ? 'border-secondary text-secondary bg-secondary-container/40'
                : 'border-outline text-on-surface-variant hover:border-secondary hover:text-secondary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}
