import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AlbumLoveButton from './AlbumLoveButton';

describe('AlbumLoveButton', () => {
  test('shows a neutral heart label and the count as separate controls when not loved', () => {
    render(
      <AlbumLoveButton
        isLoved={false}
        count={5}
        onToggle={vi.fn()}
        onCountClick={vi.fn()}
        isPending={false}
      />
    );

    const heartButton = screen.getByRole('button', { name: 'Love this album' });
    expect(heartButton).toHaveAttribute('aria-pressed', 'false');
    expect(heartButton).not.toHaveTextContent('5');

    const countButton = screen.getByRole('button', { name: 'See who loved this album (5)' });
    expect(countButton).toHaveTextContent('5');
  });

  test('shows a loved label when the viewer has loved the album', () => {
    render(
      <AlbumLoveButton
        isLoved={true}
        count={6}
        onToggle={vi.fn()}
        onCountClick={vi.fn()}
        isPending={false}
      />
    );

    const heartButton = screen.getByRole('button', {
      name: 'You loved this album — tap to remove',
    });
    expect(heartButton).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'See who loved this album (6)' })).toHaveTextContent(
      '6'
    );
  });

  test('always renders the count button, including zero, but disables it', () => {
    render(
      <AlbumLoveButton
        isLoved={false}
        count={0}
        onToggle={vi.fn()}
        onCountClick={vi.fn()}
        isPending={false}
      />
    );

    const countButton = screen.getByRole('button', { name: 'See who loved this album (0)' });
    expect(countButton).toHaveTextContent('0');
    expect(countButton).toBeDisabled();
  });

  test('calls onToggle when the heart is clicked', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(
      <AlbumLoveButton
        isLoved={false}
        count={0}
        onToggle={onToggle}
        onCountClick={vi.fn()}
        isPending={false}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Love this album' }));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  test('calls onCountClick when the count is clicked and count > 0', async () => {
    const onCountClick = vi.fn();
    const user = userEvent.setup();
    render(
      <AlbumLoveButton
        isLoved={false}
        count={3}
        onToggle={vi.fn()}
        onCountClick={onCountClick}
        isPending={false}
      />
    );

    await user.click(screen.getByRole('button', { name: 'See who loved this album (3)' }));

    expect(onCountClick).toHaveBeenCalledTimes(1);
  });

  test('disables the heart while pending and does not call onToggle when clicked', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(
      <AlbumLoveButton
        isLoved={false}
        count={2}
        onToggle={onToggle}
        onCountClick={vi.fn()}
        isPending={true}
      />
    );

    const heartButton = screen.getByRole('button', { name: 'Love this album' });
    expect(heartButton).toBeDisabled();

    await user.click(heartButton);
    expect(onToggle).not.toHaveBeenCalled();
  });
});
