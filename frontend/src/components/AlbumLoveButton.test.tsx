import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AlbumLoveButton from './AlbumLoveButton';

describe('AlbumLoveButton', () => {
  test('shows the count and a neutral label when not loved', () => {
    render(<AlbumLoveButton isLoved={false} count={5} onToggle={vi.fn()} isPending={false} />);

    const button = screen.getByRole('button', { name: 'Love this album' });
    expect(button).toHaveTextContent('5');
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  test('shows a loved label and state when the viewer has loved the album', () => {
    render(<AlbumLoveButton isLoved={true} count={6} onToggle={vi.fn()} isPending={false} />);

    const button = screen.getByRole('button', {
      name: 'You loved this album — tap to remove',
    });
    expect(button).toHaveTextContent('6');
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });

  test('always renders the count, including zero', () => {
    render(<AlbumLoveButton isLoved={false} count={0} onToggle={vi.fn()} isPending={false} />);

    expect(screen.getByRole('button', { name: 'Love this album' })).toHaveTextContent('0');
  });

  test('calls onToggle when clicked', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(<AlbumLoveButton isLoved={false} count={0} onToggle={onToggle} isPending={false} />);

    await user.click(screen.getByRole('button', { name: 'Love this album' }));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  test('disables the button while pending and does not call onToggle when clicked', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(<AlbumLoveButton isLoved={false} count={2} onToggle={onToggle} isPending={true} />);

    const button = screen.getByRole('button', { name: 'Love this album' });
    expect(button).toBeDisabled();

    await user.click(button);
    expect(onToggle).not.toHaveBeenCalled();
  });
});
