import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Modal from '../../../components/Modal';
import Icon from '../../../components/Icon';
import { useCreateCircle } from '../hooks';
import { circleFormSchema, MAX_CIRCLE_DESCRIPTION_LENGTH, type CircleFormInput } from '../schemas';

type CreateCircleModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function CreateCircleModal({ isOpen, onClose }: CreateCircleModalProps) {
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
    reset();
    createCircle.reset();
    onClose();
  };

  const onSubmit = (data: CircleFormInput) => {
    createCircle.mutate(data, { onSuccess: close });
  };

  return (
    <Modal isOpen={isOpen} onClose={close}>
      <div className="flex justify-between items-start mb-8">
        <div>
          <h2 className="font-display text-headline-md text-primary mb-2">New Circle</h2>
          <p className="font-body italic text-on-surface-variant">
            Define the boundaries of this collection.
          </p>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="text-on-surface-variant hover:text-primary transition-colors"
        >
          <Icon name="close" className="text-2xl" />
        </button>
      </div>

      {createCircle.isError && (
        <p
          role="alert"
          className="mb-6 px-4 py-3 bg-error-container text-on-error-container rounded-paper font-ui text-sm"
        >
          {createCircle.error.message}
        </p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-8">
        <div className="flex flex-col gap-1">
          <label
            className="font-ui text-ui-label uppercase text-on-surface-variant"
            htmlFor="circle-name"
          >
            Circle name
          </label>
          <input
            id="circle-name"
            className="line-input w-full py-2 text-headline-md font-display"
            placeholder="e.g., The Sterling Family"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? 'circle-name-error' : undefined}
            {...register('name')}
          />
          {errors.name && (
            <span id="circle-name-error" role="alert" className="text-sm text-error font-ui mt-1">
              {errors.name.message}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label
            className="font-ui text-ui-label uppercase text-on-surface-variant"
            htmlFor="circle-description"
          >
            Description
          </label>
          <textarea
            id="circle-description"
            rows={3}
            className="line-input w-full py-2 text-body-text resize-none"
            placeholder="What's this circle for?"
            aria-invalid={!!errors.description}
            aria-describedby={errors.description ? 'circle-description-error' : undefined}
            {...register('description')}
          />
          <div className="flex justify-between items-start mt-1">
            {errors.description ? (
              <span id="circle-description-error" role="alert" className="text-sm text-error font-ui">
                {errors.description.message}
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
          {createCircle.isPending ? 'Creating…' : 'Create Circle'}
        </button>
      </form>
    </Modal>
  );
}
