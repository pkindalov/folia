import { Link } from 'react-router-dom';
import AppShell from '../../../components/AppShell';
import Icon from '../../../components/Icon';
import { mockArchivedVolumes } from '../mock';

export default function ArchivePage() {
  const totalPages = mockArchivedVolumes.reduce((sum, v) => sum + v.pageCount, 0);

  return (
    <AppShell>
      <div className="p-gutter md:p-margin-edge">
        <div className="max-w-6xl mx-auto">
          <div className="mb-12 border-b border-outline-variant pb-6">
            <h2 className="font-display text-display-lg text-primary mb-2">The Grand Archive</h2>
            <p className="font-body text-body-text text-on-surface-variant max-w-2xl">
              Completed volumes, sealed and preserved. Pull a spine from the shelf to revisit a
              finished chapter of the story.
            </p>
          </div>

          {/* The shelf */}
          <div className="relative mb-16">
            <div className="flex items-end gap-1 overflow-x-auto pb-0 pt-8 px-6 min-h-70">
              {mockArchivedVolumes.map((volume, i) => (
                <Link
                  key={volume._id}
                  to={`/book/${volume._id}`}
                  className="group relative shrink-0 w-16 md:w-20 rounded-t-paper shadow-[2px_0_6px_rgba(0,0,0,0.25)] transition-transform duration-300 hover:-translate-y-4 focus:-translate-y-4"
                  style={{
                    backgroundColor: volume.spineColor,
                    height: `${210 + (i % 3) * 22}px`,
                  }}
                >
                  <div className="absolute inset-x-0 top-0 h-2 bg-white/10" />
                  <div className="absolute inset-y-0 left-0 w-px bg-white/20" />
                  <div className="absolute inset-y-0 right-0 w-px bg-black/30" />
                  <span
                    className="absolute inset-0 flex items-center justify-center font-display italic text-surface/90 text-sm md:text-base whitespace-nowrap"
                    style={{ writingMode: 'vertical-rl' }}
                  >
                    {volume.title} · {volume.years}
                  </span>
                </Link>
              ))}
              {/* Empty slots */}
              {[0, 1].map((slot) => (
                <div
                  key={slot}
                  className="shrink-0 w-16 md:w-20 h-50 border border-dashed border-outline-variant rounded-t-paper opacity-50"
                />
              ))}
            </div>
            {/* Shelf base */}
            <div className="h-4 bg-linear-to-b from-[#6E5A44] to-[#4A3B2C] rounded-paper shadow-[0_10px_25px_rgba(0,0,0,0.3)]" />
          </div>

          {/* Stats bento */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-surface-container-low p-8 paper-depth border border-outline-variant/20 rounded-card">
              <h3 className="font-ui text-ui-label text-on-surface-variant uppercase mb-2">
                Total Archives
              </h3>
              <p className="font-display text-display-lg text-primary">
                {mockArchivedVolumes.length}
              </p>
              <p className="font-body italic text-sm text-on-surface-variant mt-2">
                volumes preserved across seven decades
              </p>
            </div>
            <div className="bg-surface-container-low p-8 paper-depth border border-outline-variant/20 rounded-card">
              <h3 className="font-ui text-ui-label text-on-surface-variant uppercase mb-2">
                Pages Bound
              </h3>
              <p className="font-display text-display-lg text-primary">{totalPages}</p>
              <p className="font-body italic text-sm text-on-surface-variant mt-2">
                every one of them a moment kept
              </p>
            </div>
            <div className="bg-surface-container-low p-8 paper-depth border border-outline-variant/20 rounded-card flex flex-col">
              <h3 className="font-ui text-ui-label text-on-surface-variant uppercase mb-2">
                Recently Preserved
              </h3>
              <p className="font-display text-2xl text-primary">The Digital Turn</p>
              <p className="font-body italic text-sm text-on-surface-variant mt-2">
                Sealed on 12 June 2026
              </p>
              <span className="mt-auto self-end text-secondary">
                <Icon name="verified" className="text-3xl" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
