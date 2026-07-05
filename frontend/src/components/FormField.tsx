import type { InputHTMLAttributes } from 'react';
import { forwardRef } from 'react';
import styles from './FormField.module.css';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

const FormField = forwardRef<HTMLInputElement, Props>(({ label, error, id, ...rest }, ref) => {
  const inputId = id ?? rest.name;
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        className={styles.input}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : undefined}
        {...rest}
      />
      {error && (
        <span id={`${inputId}-error`} className={styles.error} role="alert">
          {error}
        </span>
      )}
    </div>
  );
});

FormField.displayName = 'FormField';
export default FormField;
