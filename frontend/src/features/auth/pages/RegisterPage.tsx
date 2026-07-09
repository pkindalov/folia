import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { registerSchema, type RegisterInput } from '../schemas';
import { useRegister } from '../hooks';
import FormField from '../../../components/FormField';
import AuthLayout from './AuthLayout';
import { toast } from '../../../lib/toast';

export default function RegisterPage() {
  const registerMutation = useRegister();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  return (
    <AuthLayout>
      <header className="mb-12">
        <h2 className="font-display text-headline-md text-primary">Begin your archive</h2>
        <p className="font-body text-body-text text-on-surface-variant mt-2">
          Create an account to start preserving memories.
        </p>
      </header>

      <form
        onSubmit={handleSubmit((data) =>
          registerMutation.mutate(data, { onError: (error) => toast.error(error.message) })
        )}
        noValidate
      >
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
          placeholder="name@legacy.com"
          error={errors.email?.message}
          {...register('email')}
        />
        <FormField
          label="Password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          error={errors.password?.message}
          {...register('password')}
        />
        <FormField
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        <div className="pt-4">
          <button
            className="w-full bg-secondary text-on-secondary py-4 font-ui text-ui-button uppercase rounded-paper shadow-sm hover:opacity-90 active:translate-y-px transition-all disabled:opacity-60"
            type="submit"
            disabled={registerMutation.isPending}
          >
            {registerMutation.isPending ? 'Creating…' : 'Create account'}
          </button>
        </div>
      </form>

      <footer className="mt-12 pt-8 border-t border-outline-variant/30 flex flex-col items-center gap-4">
        <p className="font-ui text-ui-label uppercase text-on-surface-variant">
          Already have an account?
        </p>
        <Link
          to="/login"
          className="font-ui text-ui-button uppercase text-primary border border-primary px-8 py-3 rounded-paper hover:bg-surface-variant transition-colors"
        >
          Sign in
        </Link>
      </footer>
    </AuthLayout>
  );
}
