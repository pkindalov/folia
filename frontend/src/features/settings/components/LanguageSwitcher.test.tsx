import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LanguageSwitcher from './LanguageSwitcher';

describe('LanguageSwitcher', () => {
  test('renders English active by default', () => {
    render(<LanguageSwitcher />);

    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: 'Български' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  test('switches to Bulgarian and updates the document language', async () => {
    const user = userEvent.setup();
    render(<LanguageSwitcher />);

    await user.click(screen.getByRole('button', { name: 'Български' }));

    expect(await screen.findByRole('button', { name: 'Български' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(document.documentElement.lang).toBe('bg');
  });
});
