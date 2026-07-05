import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import FormField from './FormField';

describe('FormField', () => {
  test('associates the label with the input', () => {
    render(<FormField label="Username" name="username" />);
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
  });

  test('renders without an error message by default', () => {
    render(<FormField label="Username" name="username" />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toHaveAttribute('aria-invalid', 'false');
  });

  test('shows the error with role="alert"', () => {
    render(<FormField label="Username" name="username" error="Username is required" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Username is required');
  });

  test('marks the input invalid and points aria-describedby at the error', () => {
    render(<FormField label="Email" name="email" error="Enter a valid email address" />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'email-error');
    expect(screen.getByRole('alert')).toHaveAttribute('id', 'email-error');
  });

  test('forwards native input props', () => {
    render(<FormField label="Password" name="password" type="password" autoComplete="new-password" />);
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
    expect(input).toHaveAttribute('autocomplete', 'new-password');
  });

  test('prefers an explicit id over the name', () => {
    render(<FormField label="Username" name="username" id="custom-id" />);
    expect(screen.getByLabelText('Username')).toHaveAttribute('id', 'custom-id');
  });
});
