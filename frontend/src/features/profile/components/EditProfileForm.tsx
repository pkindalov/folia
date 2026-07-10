import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import FormField from '../../../components/FormField';
import { useUpdateProfile } from '../hooks';
import { updateProfileSchema, type UpdateProfileInput } from '../schemas';
import { toast } from '../../../lib/toast';
import type { User } from '../../auth';

type EditProfileFormProps = {
  user: User;
  onCancel: () => void;
  onSaved: () => void;
};

export default function EditProfileForm({ user, onCancel, onSaved }: EditProfileFormProps) {
  const updateProfile = useUpdateProfile();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { username: user.username, email: user.email },
  });

  const onSubmit = (data: UpdateProfileInput) => {
    updateProfile.mutate(data, {
      onSuccess: () => {
        toast.success('Profile updated.');
        onSaved();
      },
      onError: (error) => toast.error(error.message),
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="w-full text-left">
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
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={updateProfile.isPending}
          className="bg-primary text-on-primary py-2 px-6 rounded-paper font-ui text-ui-label uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-60"
        >
          {updateProfile.isPending ? 'Saving…' : 'Save changes'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="py-2 px-6 rounded-paper border border-outline-variant/50 font-ui text-ui-label uppercase tracking-widest hover:bg-surface-container-low transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
