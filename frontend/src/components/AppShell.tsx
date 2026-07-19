import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMe, useLogout } from '../features/auth';
import { NotificationBellContainer } from '../features/notifications';
import Avatar from './Avatar';
import Icon from './Icon';

const NAV_ITEMS = [
  { to: '/flipbooks', icon: 'auto_stories', labelKey: 'nav.myFlipbooks' },
  { to: '/explore', icon: 'travel_explore', labelKey: 'nav.explore' },
  { to: '/editor', icon: 'edit_note', labelKey: 'nav.create' },
  { to: '/circles', icon: 'diversity_3', labelKey: 'nav.circles' },
  { to: '/archive', icon: 'inventory_2', labelKey: 'nav.archives' },
] as const;

export default function AppShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation('common');
  const { data: user, isLoading, isError } = useMe();
  const logout = useLogout();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center font-body italic text-on-surface-variant">
        {t('shell.loading')}
      </div>
    );
  }

  if (isError || !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6">
        <p className="font-body text-body-text">{t('shell.sessionExpired')}</p>
        <button
          onClick={logout}
          className="font-ui text-ui-label uppercase border border-outline px-6 py-3 rounded-paper hover:border-secondary hover:text-secondary transition-colors"
        >
          {t('shell.backToLogin')}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen md:flex">
      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 inset-x-0 z-50 flex justify-between items-center px-6 py-4 bg-surface-container-lowest border-b border-outline-variant/40 shadow-[0px_4px_20px_rgba(0,0,0,0.05)]">
        <Link to="/" className="font-display font-bold text-2xl tracking-tighter">Folia</Link>
        <div className="flex items-center gap-3">
          <Link to="/profile" className="flex items-center gap-2">
            <span className="font-body text-sm text-on-surface-variant">{user.username}</span>
            <Avatar username={user.username} avatarUrl={user.avatarUrl} size="sm" />
          </Link>
          <Link
            to="/settings"
            className="text-on-surface-variant hover:text-secondary transition-colors"
            aria-label={t('nav.settings')}
          >
            <Icon name="settings" className="text-xl" />
          </Link>
          <NotificationBellContainer variant="mobile" />
          <button
            onClick={logout}
            className="text-on-surface-variant hover:text-secondary transition-colors"
            aria-label={t('nav.signOut')}
          >
            <Icon name="logout" className="text-xl" />
          </button>
        </div>
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col py-12 px-8 bg-surface-container-lowest fixed left-0 top-0 h-full w-72 border-r border-outline-variant/50 shadow-[10px_0px_30px_rgba(0,0,0,0.03)] z-40">
        <Link to="/" className="mb-12 block">
          <h1 className="font-display font-semibold text-3xl text-primary">Folia</h1>
          <p className="font-body text-sm text-on-surface-variant italic mt-1">Preserving Legacy</p>
        </Link>
        <nav className="flex-1 flex flex-col gap-2">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-4 px-4 py-3 font-body text-sm tracking-wide uppercase rounded-paper transition-colors ${
                  isActive
                    ? 'text-primary font-bold italic underline underline-offset-8 bg-surface-container-low'
                    : 'text-on-surface-variant hover:bg-surface-container-low'
                }`
              }
            >
              <Icon name={item.icon} className="text-lg" />
              {t(item.labelKey)}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto pt-8 border-t border-outline-variant/50 flex flex-col gap-6">
          <NotificationBellContainer variant="sidebar" />
          <Link
            to="/profile"
            aria-label={t('shell.viewProfile')}
            className="flex items-center gap-3 px-4 hover:opacity-80 transition-opacity"
          >
            <Avatar username={user.username} avatarUrl={user.avatarUrl} size="sm" />
            <p className="font-body text-sm text-on-surface-variant">
              {t('shell.signedInAs')} <strong>{user.username}</strong> ({user.email})
              {user.roles.includes('Admin') && t('shell.admin')}
            </p>
          </Link>
          <Link
            to="/settings"
            className="flex items-center gap-4 px-4 py-3 font-body text-sm tracking-wide uppercase text-on-surface-variant hover:bg-surface-container-low rounded-paper transition-colors"
          >
            <Icon name="settings" className="text-lg" />
            {t('nav.settings')}
          </Link>
          <button
            onClick={logout}
            className="flex items-center gap-4 px-4 py-3 font-body text-sm tracking-wide uppercase text-on-surface-variant hover:bg-surface-container-low rounded-paper transition-colors text-left"
          >
            <Icon name="logout" className="text-lg" />
            {t('nav.signOut')}
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 md:ml-72 pt-20 md:pt-0 pb-28 md:pb-0 min-h-screen">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-surface/90 backdrop-blur-md rounded-t-pill border-t border-outline-variant shadow-[0_-2px_4px_rgba(0,0,0,0.05)]">
        <div className="flex justify-around items-center py-2 px-4">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center px-4 py-1 rounded-pill transition-all active:scale-95 ${
                  isActive ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant'
                }`
              }
            >
              <Icon name={item.icon} />
              <span className="font-ui text-[10px]">{t(item.labelKey)}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
