import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { loginSchema, type LoginInput } from '../schemas';
import { useLogin } from '../hooks';
import FormField from '../../../components/FormField';
import AuthLayout from './AuthLayout';

export default function LoginPage() {
  const login = useLogin();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  return (
    <AuthLayout>
      <header className="mb-12">
        <h2 className="font-display text-headline-md text-primary">Welcome back</h2>
        <p className="font-body text-body-text text-on-surface-variant mt-2">
          Enter your credentials to access your archive.
        </p>
      </header>

      {login.isError && (
        <p className="mb-8 px-4 py-3 bg-error-container text-on-error-container rounded-paper font-ui text-sm">
          {login.error.message}
        </p>
      )}

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
          placeholder="••••••••"
          error={errors.password?.message}
          {...register('password')}
        />
        <div className="pt-4">
          <button
            className="w-full bg-secondary text-on-secondary py-4 font-ui text-ui-button uppercase rounded-paper shadow-sm hover:opacity-90 active:translate-y-[1px] transition-all disabled:opacity-60"
            type="submit"
            disabled={login.isPending}
          >
            {login.isPending ? 'Signing in…' : 'Sign in'}
          </button>
        </div>
      </form>

      <footer className="mt-12 pt-8 border-t border-outline-variant/30 flex flex-col items-center gap-4">
        <p className="font-ui text-ui-label uppercase text-on-surface-variant">New to Folia?</p>
        <Link
          to="/register"
          className="font-ui text-ui-button uppercase text-primary border border-primary px-8 py-3 rounded-paper hover:bg-surface-variant transition-colors"
        >
          Create one
        </Link>
      </footer>
    </AuthLayout>
  );
}
