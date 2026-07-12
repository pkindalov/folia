import type { ComponentProps } from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ReactorsModal from './ReactorsModal';

const REACTORS = [
  { username: 'maria', type: 'love' as const },
  { username: 'sam', type: 'like' as const },
];

const renderModal = (props: Partial<ComponentProps<typeof ReactorsModal>> = {}) =>
  render(
    <MemoryRouter>
      <ReactorsModal
        isOpen
        onClose={vi.fn()}
        heading="People who reacted"
        reactors={REACTORS}
        {...props}
      />
    </MemoryRouter>
  );

describe('ReactorsModal', () => {
  test('renders nothing when closed', () => {
    renderModal({ isOpen: false });
    expect(screen.queryByText('maria')).not.toBeInTheDocument();
  });

  test('shows the given heading, wired as the dialog\'s accessible name', () => {
    renderModal({ heading: 'People who loved this album' });
    expect(screen.getByRole('heading', { name: 'People who loved this album' })).toBeInTheDocument();
    expect(
      screen.getByRole('dialog', { name: 'People who loved this album' })
    ).toBeInTheDocument();
  });

  test('two instances mounted at once get independent heading ids, not a shared one', () => {
    render(
      <MemoryRouter>
        <ReactorsModal isOpen onClose={vi.fn()} heading="Album reactors" reactors={[]} />
        <ReactorsModal isOpen onClose={vi.fn()} heading="Photo reactors" reactors={[]} />
      </MemoryRouter>
    );

    expect(screen.getByRole('dialog', { name: 'Album reactors' })).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Photo reactors' })).toBeInTheDocument();
  });

  test('lists each reactor as a link to their profile page', () => {
    renderModal();

    expect(screen.getByRole('link', { name: 'maria' })).toHaveAttribute('href', '/users/maria');
    expect(screen.getByRole('link', { name: 'sam' })).toHaveAttribute('href', '/users/sam');
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

  test('renders a deleted user as plain text, not a link to a dead-end profile', () => {
    renderModal({ reactors: [{ username: 'Deleted user', type: 'love' }] });

    expect(screen.getByText('Deleted user')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Deleted user' })).not.toBeInTheDocument();
  });

  test('shows a remove button only on the viewer\'s own row', () => {
    renderModal({ viewerUsername: 'sam', onRemoveMyReaction: vi.fn() });

    expect(screen.getAllByRole('button', { name: 'Remove your reaction' })).toHaveLength(1);
    const samRow = screen.getByRole('link', { name: 'sam' }).closest('li') as HTMLElement;
    expect(within(samRow).getByRole('button', { name: 'Remove your reaction' })).toBeInTheDocument();
    const mariaRow = screen.getByRole('link', { name: 'maria' }).closest('li') as HTMLElement;
    expect(within(mariaRow).queryByRole('button', { name: 'Remove your reaction' })).not.toBeInTheDocument();
  });

  test('clicking the remove button calls onRemoveMyReaction, not the profile link', async () => {
    const onRemoveMyReaction = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderModal({ viewerUsername: 'sam', onRemoveMyReaction, onClose });

    await user.click(screen.getByRole('button', { name: 'Remove your reaction' }));

    expect(onRemoveMyReaction).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  test('shows no remove button when removal is not wired up, even for the viewer\'s own row', () => {
    renderModal({ viewerUsername: 'sam' }); // no onRemoveMyReaction
    expect(screen.queryByRole('button', { name: 'Remove your reaction' })).not.toBeInTheDocument();
  });

  test('shows no remove button when no row matches the viewer\'s username', () => {
    renderModal({ onRemoveMyReaction: vi.fn() }); // viewerUsername left unset
    expect(screen.queryByRole('button', { name: 'Remove your reaction' })).not.toBeInTheDocument();
  });
});
