import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Avatar from './Avatar';

describe('Avatar', () => {
  test('renders an image when avatarUrl is set', () => {
    const { container } = render(<Avatar username="pan" avatarUrl="/uploads/avatars/x/y.jpg" />);
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', '/uploads/avatars/x/y.jpg');
  });

  test('falls back to an initials circle when there is no avatarUrl', () => {
    const { container } = render(<Avatar username="pan" avatarUrl={null} />);
    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(screen.getByText('P')).toBeInTheDocument();
  });

  test('falls back to initials when avatarUrl is undefined', () => {
    render(<Avatar username="maria" />);
    expect(screen.getByText('M')).toBeInTheDocument();
  });
});
