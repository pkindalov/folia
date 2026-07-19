import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { registerSchema, type RegisterInput } from '../schemas';
import { useRegister } from '../hooks';
import { translateFieldError } from '../../../lib/translateFieldError';
import FormField from '../../../components/FormField';
import AuthLayout from './AuthLayout';
import { toast } from '../../../lib/toast';

export default function RegisterPage() {
  const { t } = useTranslation('auth');
  const registerMutation = useRegister();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  return (
    <AuthLayout>
      <header className="mb-12">
        <h2 className="font-display text-headline-md text-primary">{t('register.heading')}</h2>
        <p className="font-body text-body-text text-on-surface-variant mt-2">
          {t('register.subheading')}
        </p>
      </header>

      <form
        onSubmit={handleSubmit((data) =>
          registerMutation.mutate(data, { onError: (error) => toast.error(error.message) })
        )}
        noValidate
      >
        <FormField
          label={t('register.usernameLabel')}
          autoComplete="username"
          error={translateFieldError(t, errors.username?.message)}
          {...register('username')}
        />
        <FormField
          label={t('register.emailLabel')}
          type="email"
          autoComplete="email"
          placeholder="name@legacy.com"
          error={translateFieldError(t, errors.email?.message)}
          {...register('email')}
        />
        <FormField
          label={t('register.passwordLabel')}
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          error={translateFieldError(t, errors.password?.message)}
          {...register('password')}
        />
        <FormField
          label={t('register.confirmPasswordLabel')}
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          error={translateFieldError(t, errors.confirmPassword?.message)}
          {...register('confirmPassword')}
        />
        <div className="pt-4">
          <button
            className="w-full bg-secondary text-on-secondary py-4 font-ui text-ui-button uppercase rounded-paper shadow-sm hover:opacity-90 active:translate-y-px transition-all disabled:opacity-60"
            type="submit"
            disabled={registerMutation.isPending}
          >
            {registerMutation.isPending ? t('register.creatingButton') : t('register.createAccountButton')}
          </button>
        </div>
      </form>

      <footer className="mt-12 pt-8 border-t border-outline-variant/30 flex flex-col items-center gap-4">
        <p className="font-ui text-ui-label uppercase text-on-surface-variant">
          {t('register.alreadyHaveAccount')}
        </p>
        <Link
          to="/login"
          className="font-ui text-ui-button uppercase text-primary border border-primary px-8 py-3 rounded-paper hover:bg-surface-variant transition-colors"
        >
          {t('register.signInLink')}
        </Link>
      </footer>
    </AuthLayout>
  );
}
