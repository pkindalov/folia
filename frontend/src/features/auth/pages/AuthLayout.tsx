import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/** Shared "open album" frame for the auth pages (from the Login/Register design). */
export default function AuthLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation('auth');

  return (
    <div className="min-h-screen bg-surface-dim flex items-center justify-center p-6 md:p-12">
      <main className="relative max-w-4xl w-full flex flex-col md:flex-row bg-surface paper-depth rounded-card overflow-hidden">
        {/* Decorative left "page" */}
        <section className="hidden md:flex flex-1 relative bg-surface-container-low border-r border-outline-variant/30 flex-col items-center justify-center p-12 overflow-hidden">
          <div className="relative z-10 -rotate-1 bg-white p-4 pb-12 shadow-md transform hover:rotate-0 transition-transform duration-500">
            <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-24 h-6 photo-tape" />
            <div className="w-64 h-64 bg-surface-variant overflow-hidden">
              <img
                className="w-full h-full object-cover grayscale-[0.3]"
                alt="A nostalgic family picnic photograph"
                src="https://picsum.photos/seed/folia-auth/512/512"
              />
            </div>
            <p className="mt-6 text-center font-body italic text-on-surface-variant">
              {t('layout.tagline')}
            </p>
          </div>
          <div className="mt-16 text-center">
            <h1 className="font-display text-display-lg text-primary italic">Folia</h1>
            <p className="font-ui text-ui-label uppercase tracking-[0.2em] text-on-surface-variant/60 mt-2">
              {t('layout.brandSubtitle')}
            </p>
          </div>
        </section>

        {/* Form "page" */}
        <section className="flex-1 bg-surface p-8 md:p-16 flex flex-col justify-center relative">
          <div className="relative z-10">{children}</div>
        </section>

        {/* Slotted corners */}
        <div className="absolute top-0 left-0 w-8 h-8 pointer-events-none border-t border-l border-outline-variant/50 m-4" />
        <div className="absolute top-0 right-0 w-8 h-8 pointer-events-none border-t border-r border-outline-variant/50 m-4" />
        <div className="absolute bottom-0 left-0 w-8 h-8 pointer-events-none border-b border-l border-outline-variant/50 m-4" />
        <div className="absolute bottom-0 right-0 w-8 h-8 pointer-events-none border-b border-r border-outline-variant/50 m-4" />
      </main>
    </div>
  );
}
