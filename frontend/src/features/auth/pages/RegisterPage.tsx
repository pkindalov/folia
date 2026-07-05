import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { registerSchema, type RegisterInput } from '../schemas';
import { useRegister } from '../hooks';
import FormField from '../../../components/FormField';
import styles from './AuthPage.module.css';

export default function RegisterPage() {
  const registerMutation = useRegister();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  return (
    <main className={styles.wrapper}>
      <div className={styles.card}>
        <h1 className={styles.title}>Folia</h1>
        <p className={styles.subtitle}>Create your account</p>

        {registerMutation.isError && (
          <p className={styles.apiError}>{registerMutation.error.message}</p>
        )}

        <form onSubmit={handleSubmit((data) => registerMutation.mutate(data))} noValidate>
          <FormField
            label="Username"
            autoComplete="username"
            error={errors.username?.message}
            {...register('username')}
          />
          <FormField
            label="Email"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email')}
          />
          <FormField
            label="Password"
            type="password"
            autoComplete="new-password"
            error={errors.password?.message}
            {...register('password')}
          />
          <button className={styles.button} type="submit" disabled={registerMutation.isPending}>
            {registerMutation.isPending ? 'Creating…' : 'Create account'}
          </button>
        </form>

        <p className={styles.switch}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
