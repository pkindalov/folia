import AppShell from '../../../components/AppShell';
import { useMe } from '../../auth';
import ProfileIdentityCard from '../components/ProfileIdentityCard';
import CirclesSummary from '../components/CirclesSummary';

export default function ProfilePage() {
  const { data: user } = useMe();

  return (
    <AppShell>
      <div className="p-gutter md:p-margin-edge">
        <div className="max-w-6xl mx-auto">
          <div className="mb-12 border-b border-outline-variant pb-6">
            <h2 className="font-display text-display-lg text-primary mb-2">My Profile</h2>
            <p className="font-body text-body-text text-on-surface-variant max-w-2xl">
              Your identity across the archive — how contributors and kin see you.
            </p>
          </div>

          {user && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-4">
                <ProfileIdentityCard user={user} />
              </div>
              <div className="lg:col-span-8">
                <CirclesSummary />
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
