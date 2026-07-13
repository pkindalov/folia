import AppShell from '../../../components/AppShell';
import Icon from '../../../components/Icon';
import { toast } from '../../../lib/toast';
import { useDeleteAccount } from '../hooks';

export default function SettingsPage() {
  const deleteAccount = useDeleteAccount();

  const onDeleteAccount = () => {
    if (
      window.confirm(
        'Delete your account? This permanently removes your volumes, the circles you own, and everything shared through them. This cannot be undone.'
      )
    ) {
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
            <h2 className="font-display text-display-lg text-primary mb-2">Settings</h2>
            <p className="font-body text-body-text text-on-surface-variant max-w-2xl">
              Manage your account.
            </p>
          </div>

          <section className="bg-surface-container-lowest rounded-card p-8 border border-error/40">
            <h3 className="font-display text-headline-sm text-error mb-2">Danger zone</h3>
            <p className="font-body text-on-surface-variant mb-6">
              Deleting your account permanently removes your volumes, the circles you own, and
              everything shared through them. This cannot be undone.
            </p>
            <button
              type="button"
              onClick={onDeleteAccount}
              disabled={deleteAccount.isPending}
              className="flex items-center gap-2 font-ui text-ui-label uppercase text-error border border-error/40 px-4 py-3 rounded-paper hover:bg-error-container/40 transition-colors disabled:opacity-50"
            >
              <Icon name="delete" className="text-lg" />
              {deleteAccount.isPending ? 'Deleting…' : 'Delete my account'}
            </button>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
