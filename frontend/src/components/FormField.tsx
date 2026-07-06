import type { InputHTMLAttributes } from 'react';
import { forwardRef } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

const FormField = forwardRef<HTMLInputElement, Props>(({ label, error, id, ...rest }, ref) => {
  const inputId = id ?? rest.name;
  return (
    <div className="flex flex-col gap-1 mb-8">
      <label
        className="font-ui text-ui-label uppercase tracking-wider text-on-surface-variant"
        htmlFor={inputId}
      >
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        className="line-input w-full py-2 text-body-text font-body"
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : undefined}
        {...rest}
      />
      {error && (
        <span id={`${inputId}-error`} className="text-sm text-error mt-1 font-ui" role="alert">
          {error}
        </span>
      )}
    </div>
  );
});

FormField.displayName = 'FormField';
export default FormField;
