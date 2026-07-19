import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { loginSchema, type LoginInput } from '../schemas';
import { useLogin } from '../hooks';
import { translateFieldError } from '../../../lib/translateFieldError';
import FormField from '../../../components/FormField';
import AuthLayout from './AuthLayout';
import { toast } from '../../../lib/toast';

export default function LoginPage() {
  const { t } = useTranslation('auth');
  const login = useLogin();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  return (
    <AuthLayout>
      <header className="mb-12">
        <h2 className="font-display text-headline-md text-primary">{t('login.heading')}</h2>
        <p className="font-body text-body-text text-on-surface-variant mt-2">
          {t('login.subheading')}
        </p>
      </header>

      <form
        onSubmit={handleSubmit((data) =>
          login.mutate(data, { onError: (error) => toast.error(error.message) })
        )}
        noValidate
      >
        <FormField
          label={t('login.identifierLabel')}
          autoComplete="username"
          error={translateFieldError(t, errors.identifier?.message)}
          {...register('identifier')}
        />
        <FormField
          label={t('login.passwordLabel')}
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          error={translateFieldError(t, errors.password?.message)}
          {...register('password')}
        />
        <div className="pt-4">
          <button
            className="w-full bg-secondary text-on-secondary py-4 font-ui text-ui-button uppercase rounded-paper shadow-sm hover:opacity-90 active:translate-y-px transition-all disabled:opacity-60"
            type="submit"
            disabled={login.isPending}
          >
            {login.isPending ? t('login.signingInButton') : t('login.signInButton')}
          </button>
        </div>
      </form>

      <footer className="mt-12 pt-8 border-t border-outline-variant/30 flex flex-col items-center gap-4">
        <p className="font-ui text-ui-label uppercase text-on-surface-variant">
          {t('login.newToFolia')}
        </p>
        <Link
          to="/register"
          className="font-ui text-ui-button uppercase text-primary border border-primary px-8 py-3 rounded-paper hover:bg-surface-variant transition-colors"
        >
          {t('login.createOne')}
        </Link>
      </footer>
    </AuthLayout>
  );
}
