import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useMe, useLogout } from '../features/auth';
import Icon from './Icon';

const NAV_ITEMS = [
  { to: '/flipbooks', icon: 'auto_stories', label: 'My Flipbooks' },
  { to: '/explore', icon: 'travel_explore', label: 'Explore' },
  { to: '/editor', icon: 'edit_note', label: 'Create' },
  { to: '/archive', icon: 'inventory_2', label: 'Archives' },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const { data: user, isLoading, isError } = useMe();
  const logout = useLogout();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center font-body italic text-on-surface-variant">
        Loading…
      </div>
    );
  }

  if (isError || !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6">
        <p className="font-body text-body-text">Session expired.</p>
        <button
          onClick={logout}
          className="font-ui text-ui-label uppercase border border-outline px-6 py-3 rounded-paper hover:border-secondary hover:text-secondary transition-colors"
        >
          Back to login
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen md:flex">
      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 inset-x-0 z-50 flex justify-between items-center px-6 py-4 bg-surface-container-lowest border-b border-outline-variant/40 shadow-[0px_4px_20px_rgba(0,0,0,0.05)]">
        <span className="font-display font-bold text-2xl tracking-tighter">Folia</span>
        <div className="flex items-center gap-3">
          <span className="font-body text-sm text-on-surface-variant">{user.username}</span>
          <span
            className="w-8 h-8 rounded-full bg-secondary text-on-secondary font-ui text-sm flex items-center justify-center"
            aria-hidden="true"
          >
            {user.username.charAt(0).toUpperCase()}
          </span>
          <button
            onClick={logout}
            className="text-on-surface-variant hover:text-secondary transition-colors"
            aria-label="Sign out"
          >
            <Icon name="logout" className="text-xl" />
          </button>
        </div>
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col py-12 px-8 bg-surface-container-lowest fixed left-0 top-0 h-full w-72 border-r border-outline-variant/50 shadow-[10px_0px_30px_rgba(0,0,0,0.03)] z-40">
        <div className="mb-12">
          <h1 className="font-display font-semibold text-3xl text-primary">Folia</h1>
          <p className="font-body text-sm text-on-surface-variant italic mt-1">Preserving Legacy</p>
        </div>
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
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto pt-8 border-t border-outline-variant/50 flex flex-col gap-6">
          <p className="font-body text-sm text-on-surface-variant px-4">
            Signed in as <strong>{user.username}</strong> ({user.email})
            {user.roles.includes('Admin') && ' — Admin'}
          </p>
          <button
            onClick={logout}
            className="flex items-center gap-4 px-4 py-3 font-body text-sm tracking-wide uppercase text-on-surface-variant hover:bg-surface-container-low rounded-paper transition-colors text-left"
          >
            <Icon name="logout" className="text-lg" />
            Sign out
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
              <span className="font-ui text-[10px]">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
