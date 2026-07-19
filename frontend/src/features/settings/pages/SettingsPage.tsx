import { useTranslation } from 'react-i18next';
import AppShell from '../../../components/AppShell';
import Icon from '../../../components/Icon';
import { toast } from '../../../lib/toast';
import { useDeleteAccount } from '../hooks';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function SettingsPage() {
  const { t } = useTranslation('settings');
  const deleteAccount = useDeleteAccount();

  const onDeleteAccount = () => {
    if (window.confirm(t('dangerZone.confirm'))) {
      deleteAccount.mutate(undefined, {
        onError: (error) => toast.error(error.message),
      });
    }
  };

  return (
    <AppShell>
      <div className="p-gutter md:p-margin-edge">
        <div className="max-w-3xl mx-auto">
          <div className="mb-12 border-b border-outline-variant pb-6">
            <h2 className="font-display text-display-lg text-primary mb-2">{t('title')}</h2>
            <p className="font-body text-body-text text-on-surface-variant max-w-2xl">
              {t('description')}
            </p>
          </div>

          <LanguageSwitcher />

          <section className="bg-surface-container-lowest rounded-card p-8 border border-error/40">
            <h3 className="font-display text-headline-sm text-error mb-2">
              {t('dangerZone.title')}
            </h3>
            <p className="font-body text-on-surface-variant mb-6">
              {t('dangerZone.description')}
            </p>
            <button
              type="button"
              onClick={onDeleteAccount}
              disabled={deleteAccount.isPending}
              className="flex items-center gap-2 font-ui text-ui-label uppercase text-error border border-error/40 px-4 py-3 rounded-paper hover:bg-error-container/40 transition-colors disabled:opacity-50"
            >
              <Icon name="delete" className="text-lg" />
              {deleteAccount.isPending ? t('dangerZone.deletingButton') : t('dangerZone.deleteButton')}
            </button>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
