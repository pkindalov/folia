import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { loginSchema, type LoginInput } from '../schemas';
import { useLogin } from '../hooks';
import FormField from '../../../components/FormField';
import styles from './AuthPage.module.css';

export default function LoginPage() {
  const login = useLogin();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  return (
    <main className={styles.wrapper}>
      <div className={styles.card}>
        <h1 className={styles.title}>Folia</h1>
        <p className={styles.subtitle}>Sign in to your library</p>

        {login.isError && <p className={styles.apiError}>{login.error.message}</p>}

        <form onSubmit={handleSubmit((data) => login.mutate(data))} noValidate>
          <FormField
            label="Username"
            autoComplete="username"
            error={errors.username?.message}
            {...register('username')}
          />
          <FormField
            label="Password"
            type="password"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register('password')}
          />
          <button className={styles.button} type="submit" disabled={login.isPending}>
            {login.isPending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className={styles.switch}>
          No account yet? <Link to="/register">Create one</Link>
        </p>
      </div>
    </main>
  );
}
