import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppShell from '../../../components/AppShell';
import { usePublicProfile } from '../hooks';
import PublicProfileCard from '../components/PublicProfileCard';

export default function PublicProfilePage() {
  const { t } = useTranslation('profile');
  const { username } = useParams();
  const { data: user, isLoading, isError, error } = usePublicProfile(username);

  return (
    <AppShell>
      <div className="p-gutter md:p-margin-edge">
        <div className="max-w-3xl mx-auto">
          {isLoading && (
            <p className="font-body italic text-on-surface-variant">
              {t('publicProfilePage.loading')}
            </p>
          )}
          {isError && (
            <p className="px-4 py-3 bg-error-container text-on-error-container rounded-paper font-ui text-sm inline-block">
              {error.message}
            </p>
          )}
          {user && <PublicProfileCard user={user} />}
        </div>
      </div>
    </AppShell>
  );
}
