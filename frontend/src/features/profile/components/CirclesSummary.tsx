import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import CreateCircleModal from '../../circles/components/CreateCircleModal';
import { useCircles } from '../../circles';

const MAX_VISIBLE_CIRCLES = 4;

export default function CirclesSummary() {
  const { t } = useTranslation('profile');
  const { data, isLoading, isError, error } = useCircles(1);
  const [isCreateOpen, setCreateOpen] = useState(false);
  const circles = data?.circles.slice(0, MAX_VISIBLE_CIRCLES) ?? [];

  return (
    <section className="bg-surface-container-lowest rounded-card p-8 border border-outline-variant/40 paper-depth">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-display text-headline-md text-primary">{t('circlesSummary.title')}</h3>
        <Link
          to="/circles"
          className="font-ui text-ui-label uppercase text-secondary hover:opacity-80 transition-opacity"
        >
          {t('circlesSummary.viewAll')}
        </Link>
      </div>

      {isLoading && (
        <p className="font-body italic text-on-surface-variant">{t('circlesSummary.gathering')}</p>
      )}
      {isError && (
        <p className="px-4 py-3 bg-error-container text-on-error-container rounded-paper font-ui text-sm inline-block">
          {error.message}
        </p>
      )}

      {data && data.total === 0 && (
        <div className="flex flex-col items-start gap-3">
          <p className="font-body italic text-on-surface-variant">
            {t('circlesSummary.emptyState')}
          </p>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="font-ui text-ui-label uppercase text-secondary hover:opacity-80 transition-opacity"
          >
            {t('circlesSummary.createFirst')}
          </button>
        </div>
      )}

      {circles.length > 0 && (
        <ul className="flex flex-col gap-4">
          {circles.map((circle) => {
            const acceptedCount = circle.members.filter(
              (member) => member.status === 'accepted'
            ).length;
            return (
              <li key={circle._id}>
                <Link
                  to={`/circles/${circle._id}`}
                  className="flex items-center justify-between px-4 py-3 rounded-paper border border-outline-variant/40 hover:bg-surface-container-low transition-colors"
                >
                  <span className="font-display text-primary">{circle.name}</span>
                  <span className="font-ui text-ui-label text-on-surface-variant">
                    {t('circlesSummary.memberCount', { count: acceptedCount })}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <CreateCircleModal isOpen={isCreateOpen} onClose={() => setCreateOpen(false)} />
    </section>
  );
}
