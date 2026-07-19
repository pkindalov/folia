import { useTranslation } from 'react-i18next';
import Avatar from '../../../components/Avatar';
import { formatMemberSince } from '../formatMemberSince';
import type { PublicUser } from '../schemas';

/** Read-only view of another user's identity — no edit form, no avatar upload. */
export default function PublicProfileCard({ user }: { user: PublicUser }) {
  const { t, i18n } = useTranslation('profile');
  const memberSince = formatMemberSince(user.createdAt, i18n.language);

  return (
    <section className="bg-surface-container-lowest rounded-card p-8 border border-outline-variant/40 paper-depth flex flex-col items-center text-center">
      <Avatar username={user.username} avatarUrl={user.avatarUrl} size="lg" />
      <h2 className="font-display text-headline-md text-primary mt-6">{user.username}</h2>

      {user.roles.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center mt-4">
          {user.roles.map((role) => (
            <span
              key={role}
              className="px-3 py-1 rounded-pill bg-surface-container-low border border-outline-variant/40 font-ui text-[11px] uppercase tracking-widest text-on-surface-variant"
            >
              {role}
            </span>
          ))}
        </div>
      )}

      {memberSince && (
        <p className="font-ui text-ui-label text-on-surface-variant/70 mt-4">
          {t('identityCard.memberSince', { date: memberSince })}
        </p>
      )}
    </section>
  );
}
