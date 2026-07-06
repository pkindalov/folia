import { Link } from 'react-router-dom';
import AppShell from '../../../components/AppShell';
import Icon from '../../../components/Icon';
import { mockCommunityAlbums } from '../mock';

export default function ExplorePage() {
  return (
    <AppShell>
      <div className="p-gutter md:p-margin-edge">
        <div className="max-w-6xl mx-auto">
          <div className="mb-12 border-b border-outline-variant pb-6">
            <h2 className="font-display text-display-lg text-primary mb-2">The Community Table</h2>
            <p className="font-body text-body-text text-on-surface-variant max-w-2xl">
              Albums shared by families and archivists around the world, laid out for browsing.
              Leave a reflection, or bookmark a volume for your reading desk.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-16">
            {mockCommunityAlbums.map((album, i) => (
              <div key={album._id} className="flex flex-col">
                <Link
                  to={`/book/${album._id}`}
                  className={`group relative block aspect-4/5 rounded-r-card overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.18)] transition-transform duration-500 hover:-translate-y-2 ${
                    i % 3 === 1 ? 'rotate-[0.6deg]' : i % 3 === 2 ? 'rotate-[-0.8deg]' : ''
                  }`}
                  style={{ backgroundColor: album.coverColor }}
                >
                  <img
                    src={album.coverImage}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover opacity-70 mix-blend-luminosity group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/10 to-transparent" />
                  <div className="absolute bottom-0 p-6">
                    <h3 className="font-display text-[28px] leading-tight text-surface font-semibold">
                      {album.title}
                    </h3>
                    <p className="font-body italic text-surface/80 text-sm mt-1">by {album.author}</p>
                  </div>
                  <div className="absolute left-3 top-0 bottom-0 w-px bg-white/20" />
                </Link>
                <div className="mt-4 px-1 flex items-center gap-6 text-on-surface-variant">
                  <span className="flex items-center gap-2 font-ui text-ui-label">
                    <Icon name="forum" className="text-lg" />
                    {album.reflections}
                  </span>
                  <span className="flex items-center gap-2 font-ui text-ui-label">
                    <Icon name="bookmark" className="text-lg" />
                    {album.bookmarks}
                  </span>
                  <span className="ml-auto">
                    <Icon name="arrow_forward" className="text-lg" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
