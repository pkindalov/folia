import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import Modal from '../../../components/Modal';
import Icon from '../../../components/Icon';
import { useCreateCircle } from '../hooks';
import { circleFormSchema, MAX_CIRCLE_DESCRIPTION_LENGTH, type CircleFormInput } from '../schemas';
import { translateFieldError } from '../../../lib/translateFieldError';
import { toast } from '../../../lib/toast';

type CreateCircleModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function CreateCircleModal({ isOpen, onClose }: CreateCircleModalProps) {
  const { t } = useTranslation('circles');
  const createCircle = useCreateCircle();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<CircleFormInput>({
    resolver: zodResolver(circleFormSchema),
    defaultValues: { name: '', description: '' },
  });

  const descriptionLength = watch('description').trim().length;

  const close = () => {
    // A pending create keeps running server-side even if the modal closes —
    // block Escape/backdrop/X until it settles so its success or error is
    // never silently discarded (see the submit button's own disabled state).
    if (createCircle.isPending) return;
    reset();
    createCircle.reset();
    onClose();
  };

  const onSubmit = (data: CircleFormInput) => {
    createCircle.mutate(data, {
      onSuccess: () => {
        toast.success(t('createModal.createdToast'));
        close();
      },
      onError: (error) => toast.error(error.message),
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={close} labelledBy="create-circle-title">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h2 id="create-circle-title" className="font-display text-headline-md text-primary mb-2">
            {t('createModal.title')}
          </h2>
          <p className="font-body italic text-on-surface-variant">{t('createModal.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label={t('createModal.closeLabel')}
          className="text-on-surface-variant hover:text-primary transition-colors"
        >
          <Icon name="close" className="text-2xl" />
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-8">
        <div className="flex flex-col gap-1">
          <label
            className="font-ui text-ui-label uppercase text-on-surface-variant"
            htmlFor="circle-name"
          >
            {t('form.nameLabel')}
          </label>
          <input
            id="circle-name"
            className="line-input w-full py-2 text-headline-md font-display"
            placeholder={t('form.namePlaceholder')}
            aria-invalid={errors.name !== undefined}
            aria-describedby={errors.name !== undefined ? 'circle-name-error' : undefined}
            {...register('name')}
          />
          {errors.name && (
            <span id="circle-name-error" role="alert" className="text-sm text-error font-ui mt-1">
              {translateFieldError(t, errors.name.message)}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label
            className="font-ui text-ui-label uppercase text-on-surface-variant"
            htmlFor="circle-description"
          >
            {t('form.descriptionLabel')}
          </label>
          <textarea
            id="circle-description"
            rows={3}
            className="line-input w-full py-2 text-body-text resize-none"
            placeholder={t('form.descriptionPlaceholder')}
            aria-invalid={errors.description !== undefined}
            aria-describedby={errors.description !== undefined ? 'circle-description-error' : undefined}
            {...register('description')}
          />
          <div className="flex justify-between items-start mt-1">
            {errors.description ? (
              <span id="circle-description-error" role="alert" className="text-sm text-error font-ui">
                {translateFieldError(t, errors.description.message, {
                  count: MAX_CIRCLE_DESCRIPTION_LENGTH,
                })}
              </span>
            ) : (
              <span />
            )}
            <span
              className={`font-ui text-[11px] ${
                descriptionLength > MAX_CIRCLE_DESCRIPTION_LENGTH
                  ? 'text-error'
                  : 'text-on-surface-variant'
              }`}
            >
              {descriptionLength}/{MAX_CIRCLE_DESCRIPTION_LENGTH}
            </span>
          </div>
        </div>

        <button
          type="submit"
          disabled={createCircle.isPending}
          className="w-full bg-primary text-on-primary py-4 px-8 rounded-paper font-ui text-ui-button uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-60"
        >
          {createCircle.isPending ? t('createModal.creatingButton') : t('createModal.createButton')}
        </button>
      </form>
    </Modal>
  );
}
