import { Link } from 'react-router-dom';
import Icon from '../../../components/Icon';

const VALUES = [
  {
    icon: 'auto_stories',
    title: 'Tactile Digital Albums',
    text: 'Experience the "friction" of discovery. Our interface uses spatial memory and physical metaphors—like paper grain and depth of field—to make browsing feel intentional.',
  },
  {
    icon: 'forum',
    title: 'Social Reflections',
    text: 'Photos are just the beginning. Invite loved ones to leave hand-ruled notes, voice memos, and stories, turning a single image into a multi-generational dialogue.',
  },
  {
    icon: 'inventory_2',
    title: 'Community Archives',
    text: 'Preserve local history or family branches in collective vaults. High-fidelity archival standards ensure your stories remain accessible for the next century.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Top nav */}
      <nav className="w-full sticky top-0 bg-surface shadow-[0px_4px_20px_rgba(0,0,0,0.05)] border-b border-outline-variant/30 z-50">
        <div className="flex justify-between items-center px-6 md:px-margin-edge py-4 max-w-7xl mx-auto">
          <span className="font-display text-[32px] font-semibold text-primary italic">Folia</span>
          <div className="flex items-center gap-6">
            <Link
              to="/login"
              className="text-on-surface-variant font-ui text-ui-label uppercase hover:text-secondary transition-colors"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="bg-secondary text-on-secondary px-6 py-3 rounded-paper font-ui text-ui-button shadow-md hover:scale-105 active:scale-95 transition-all duration-200"
            >
              Start for Free
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 md:px-margin-edge py-12 flex-1">
        {/* Hero */}
        <section className="grid lg:grid-cols-2 gap-16 items-center mb-24 min-h-153.5">
          <div className="flex flex-col gap-8 order-2 lg:order-1">
            <h1 className="font-display text-display-lg leading-tight">
              Preserve Your Legacy in a <span className="italic">Tactile</span> Digital World.
            </h1>
            <p className="font-body text-body-text text-on-surface-variant max-w-lg">
              More than a gallery. A digital heirloom crafted with the soul of a physical album.
              Capture social reflections and curate community archives that stand the test of time.
            </p>
            <div className="flex flex-wrap gap-4 pt-4">
              <Link
                to="/register"
                className="bg-secondary text-on-secondary px-8 py-4 rounded-paper font-ui text-lg shadow-lg hover:shadow-xl transition-all"
              >
                Begin Your Album
              </Link>
              <Link
                to="/login"
                className="border border-primary text-primary px-8 py-4 rounded-paper font-ui text-lg hover:bg-surface-container transition-all"
              >
                View Sample Legacy
              </Link>
            </div>
            <div className="mt-8 flex items-center gap-4 text-outline">
              <Icon name="history_edu" className="text-secondary" />
              <span className="font-ui text-ui-label italic">
                Join 12,000+ families preserving their story.
              </span>
            </div>
          </div>
          {/* Hero image frame */}
          <div className="order-1 lg:order-2 flex justify-center items-center relative py-12">
            <div className="absolute inset-0 bg-secondary/5 rounded-full blur-3xl -z-10" />
            <div className="relative p-4 bg-white shadow-2xl rotate-2 paper-depth border-r border-outline-variant/20 page-curl-hover cursor-pointer group">
              <div className="absolute -top-4 -left-4 photo-tape opacity-80 z-10" />
              <div className="absolute -bottom-4 -right-4 photo-tape opacity-80 z-10 -scale-x-100 rotate-15" />
              <div className="relative overflow-hidden w-full max-w-md aspect-4/5 bg-surface-dim">
                <img
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
                  alt="A handcrafted leather-bound album in warm afternoon light"
                  src="https://picsum.photos/seed/folia-hero/640/800"
                />
                <div className="absolute inset-y-0 left-0 w-px bg-white/30" />
                <div className="absolute inset-y-0 right-0 w-px bg-black/10" />
              </div>
            </div>
          </div>
        </section>

        {/* Values bento */}
        <section className="mb-24">
          <div className="flex flex-col items-center text-center mb-16">
            <h2 className="font-display text-headline-md mb-4">The Craft of Memory</h2>
            <div className="w-24 h-px bg-secondary opacity-30" />
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {VALUES.map((value) => (
              <div
                key={value.title}
                className="bg-surface p-10 paper-depth border border-outline-variant/10 flex flex-col gap-6 relative overflow-hidden group"
              >
                <div className="text-secondary opacity-20 absolute -right-4 -top-4">
                  <Icon name={value.icon} className="text-[120px]!" />
                </div>
                <Icon name={value.icon} className="text-secondary text-4xl" />
                <h3 className="font-display text-2xl">{value.title}</h3>
                <p className="text-on-surface-variant font-body">{value.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Showcase */}
        <section className="grid lg:grid-cols-12 gap-12 items-center mb-32 bg-surface-container/30 p-8 md:p-12 rounded-card">
          <div className="lg:col-span-5 flex flex-col gap-6">
            <span className="font-ui text-ui-label text-secondary uppercase tracking-widest">
              The Archive Experience
            </span>
            <h2 className="font-display text-4xl leading-snug">Curated by you, crafted for them.</h2>
            <p className="font-body text-on-surface-variant italic">
              "We didn't want another cloud folder. We wanted a place that felt like my
              grandmother's attic—full of surprises and weight."
            </p>
            <div className="flex flex-col gap-4 mt-4">
              {[
                ['Museum-Grade Scanning', 'Digitize physical artifacts with our curated partner network.'],
                ['Private Family Circles', 'Your legacy is yours. No ads, no tracking, just preservation.'],
              ].map(([title, text]) => (
                <div key={title} className="flex items-start gap-4">
                  <Icon name="check_circle" className="text-secondary" />
                  <div>
                    <h4 className="font-ui text-ui-label uppercase">{title}</h4>
                    <p className="text-sm text-on-surface-variant font-body">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-7 grid grid-cols-2 gap-4 relative">
            <div className="pt-12">
              <div className="bg-white p-2 stuck-photo -rotate-2 mb-6">
                <img className="w-full aspect-square object-cover" alt="A 1940s family gathering" src="https://picsum.photos/seed/folia-s1/480/480" />
              </div>
              <div className="bg-white p-2 stuck-photo rotate-1">
                <img className="w-full aspect-3/4 object-cover" alt="A handwritten letter on aged parchment" src="https://picsum.photos/seed/folia-s2/480/640" />
              </div>
            </div>
            <div>
              <div className="bg-white p-2 stuck-photo rotate-3 mb-6">
                <img className="w-full aspect-4/5 object-cover" alt="Grandmother and child browsing a digital album" src="https://picsum.photos/seed/folia-s3/480/600" />
              </div>
              <div className="bg-white p-2 stuck-photo -rotate-1 translate-x-4">
                <img className="w-full aspect-square object-cover" alt="Vintage memorabilia flat-lay" src="https://picsum.photos/seed/folia-s4/480/480" />
              </div>
            </div>
          </div>
        </section>

        {/* Invitation */}
        <section className="max-w-3xl mx-auto text-center py-20 px-8 bg-surface-container-high rounded-pill border border-outline-variant/20 paper-depth mb-24">
          <h2 className="font-display text-headline-md mb-6">Receive our 'Curation Guide'</h2>
          <p className="text-on-surface-variant mb-10 px-8 font-body">
            Join our quarterly newsletter on archival standards, legacy storytelling, and the art of
            the physical-digital bridge.
          </p>
          <form className="flex flex-col md:flex-row gap-6 justify-center px-8" onSubmit={(e) => e.preventDefault()}>
            <div className="flex-1 text-left">
              <label className="font-ui text-[12px] text-outline ml-1 uppercase" htmlFor="newsletter-email">
                Your email
              </label>
              <input id="newsletter-email" className="line-input w-full py-2 text-lg" placeholder="name@archive.com" type="email" />
            </div>
            <button className="bg-primary text-on-primary px-8 py-4 rounded-paper font-ui text-ui-button hover:opacity-90 transition-all self-end" type="submit">
              Request Invite
            </button>
          </form>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full mt-auto py-12 px-6 md:px-margin-edge flex flex-col md:flex-row justify-between items-center gap-4 bg-surface-dim border-t border-outline-variant/20">
        <div className="flex flex-col gap-2 text-center md:text-left">
          <span className="font-display text-2xl text-primary italic">Folia</span>
          <p className="font-ui text-ui-label text-on-surface-variant">
            © 2026 Folia. Preservation through tactile storytelling.
          </p>
        </div>
        <div className="flex gap-8">
          {['Legacy Policy', 'Archival Standards', 'Curation Guide'].map((label) => (
            <a key={label} className="text-on-surface-variant opacity-80 hover:text-secondary underline transition-all font-ui text-ui-label" href="#top">
              {label}
            </a>
          ))}
        </div>
      </footer>
    </div>
  );
}
