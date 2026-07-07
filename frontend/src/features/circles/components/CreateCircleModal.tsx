import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Modal from '../../../components/Modal';
import Icon from '../../../components/Icon';
import { useCreateCircle } from '../hooks';
import { circleFormSchema, PURPOSE_LABELS, PURPOSES, type CircleFormInput } from '../schemas';

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
    defaultValues: { name: '', purpose: 'family_lineage', privacy: 'private' },
  });

  const purpose = watch('purpose');
  const privacy = watch('privacy');

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

        <fieldset>
          <legend className="font-ui text-ui-label uppercase text-on-surface-variant mb-4">
            Purpose
          </legend>
          <div className="grid grid-cols-2 gap-3">
            {PURPOSES.map((value) => (
              <label
                key={value}
                className={`flex items-center gap-3 p-4 rounded-paper border cursor-pointer transition-colors ${
                  purpose === value
                    ? 'border-secondary bg-secondary/5 text-primary'
                    : 'border-outline-variant/50 text-on-surface-variant hover:bg-surface-container-low'
                }`}
              >
                <input type="radio" value={value} className="sr-only" {...register('purpose')} />
                <span className="font-body text-sm">{PURPOSE_LABELS[value]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="font-ui text-ui-label uppercase text-on-surface-variant mb-4">
            Privacy level
          </legend>
          <div className="flex gap-4">
            <label
              className={`flex-1 py-3 px-4 rounded-paper border font-ui text-ui-label uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                privacy === 'private'
                  ? 'border-primary bg-primary text-on-primary'
                  : 'border-outline-variant/50 hover:bg-surface-container-low'
              }`}
            >
              <input type="radio" value="private" className="sr-only" {...register('privacy')} />
              <Icon name="lock" className="text-sm" filled={privacy === 'private'} />
              Private
            </label>
            <label
              className={`flex-1 py-3 px-4 rounded-paper border font-ui text-ui-label uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                privacy === 'restricted'
                  ? 'border-primary bg-primary text-on-primary'
                  : 'border-outline-variant/50 hover:bg-surface-container-low'
              }`}
            >
              <input type="radio" value="restricted" className="sr-only" {...register('privacy')} />
              <Icon name="group" className="text-sm" filled={privacy === 'restricted'} />
              Restricted
            </label>
          </div>
        </fieldset>

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
