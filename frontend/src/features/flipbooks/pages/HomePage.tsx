import { useMe, useLogout } from '../../auth';
import styles from './HomePage.module.css';

export default function HomePage() {
  const { data: user, isLoading, isError } = useMe();
  const logout = useLogout();

  if (isLoading) return <main className={styles.wrapper}>Loading…</main>;

  if (isError || !user) {
    return (
      <main className={styles.wrapper}>
        <p>Session expired.</p>
        <button className={styles.logout} onClick={logout}>
          Back to login
        </button>
      </main>
    );
  }

  return (
    <main className={styles.wrapper}>
      <header className={styles.header}>
        <h1 className={styles.title}>My Flipbooks</h1>
        <button className={styles.logout} onClick={logout}>
          Sign out
        </button>
      </header>
      <p className={styles.meta}>
        Signed in as <strong>{user.username}</strong> ({user.email})
        {user.roles.includes('Admin') && ' — Admin'}
      </p>
      <p className={styles.meta}>Flipbook creation coming soon.</p>
    </main>
  );
}
