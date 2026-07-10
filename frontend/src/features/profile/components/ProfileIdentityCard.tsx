import { useState } from 'react';
import AvatarUploader from './AvatarUploader';
import EditProfileForm from './EditProfileForm';
import type { User } from '../../auth';

function formatMemberSince(createdAt: string | undefined): string | null {
  if (!createdAt) return null;
  return new Date(createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function ProfileIdentityCard({ user }: { user: User }) {
  const [isEditing, setIsEditing] = useState(false);
  const memberSince = formatMemberSince(user.createdAt);

  return (
    <section className="bg-surface-container-lowest rounded-card p-8 border border-outline-variant/40 paper-depth flex flex-col items-center text-center">
      <AvatarUploader username={user.username} avatarUrl={user.avatarUrl} />

      {isEditing ? (
        <div className="mt-8">
          <EditProfileForm
            user={user}
            onCancel={() => setIsEditing(false)}
            onSaved={() => setIsEditing(false)}
          />
        </div>
      ) : (
        <>
          <h2 className="font-display text-headline-md text-primary mt-6">{user.username}</h2>
          <p className="font-body text-on-surface-variant mt-1">{user.email}</p>

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
              Member since {memberSince}
            </p>
          )}

          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="w-full mt-8 py-2 rounded-paper border border-primary text-primary font-ui text-ui-label uppercase tracking-widest hover:bg-primary hover:text-on-primary transition-colors"
          >
            Edit Profile
          </button>
        </>
      )}
    </section>
  );
}
