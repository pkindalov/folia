import type { ComponentProps } from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AlbumReactorsModal from './AlbumReactorsModal';

const renderModal = (props: Partial<ComponentProps<typeof AlbumReactorsModal>> = {}) =>
  render(
    <MemoryRouter>
      <AlbumReactorsModal
        isOpen
        onClose={vi.fn()}
        reactors={['maria', 'sam']}
        {...props}
      />
    </MemoryRouter>
  );

describe('AlbumReactorsModal', () => {
  test('renders nothing when closed', () => {
    renderModal({ isOpen: false });
    expect(screen.queryByText('maria')).not.toBeInTheDocument();
  });

  test('lists each reactor as a link to their profile page', () => {
    renderModal();

    const mariaLink = screen.getByRole('link', { name: 'maria' });
    expect(mariaLink).toHaveAttribute('href', '/users/maria');

    const samLink = screen.getByRole('link', { name: 'sam' });
    expect(samLink).toHaveAttribute('href', '/users/sam');
  });

  test('closes when a reactor link is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderModal({ onClose });

    await user.click(screen.getByRole('link', { name: 'maria' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('closes via the header close button', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderModal({ onClose });

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('renders an empty list without error when there are no reactors', () => {
    renderModal({ reactors: [] });
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
