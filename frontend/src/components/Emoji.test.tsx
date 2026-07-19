import { describe, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Emoji from './Emoji';

describe('Emoji', () => {
  test('renders the Twemoji SVG image', () => {
    const { container } = render(<Emoji emoji="❤️" />);
    expect(container.querySelector('img')).toBeInTheDocument();
  });

  test('falls back to the native emoji character when the image fails to load', () => {
    const { container } = render(<Emoji emoji="❤️" />);
    const img = container.querySelector('img')!;

    fireEvent.error(img);

    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(screen.getByText('❤️')).toBeInTheDocument();
  });
});
