import type { ComponentProps } from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import PhotoLightbox from './PhotoLightbox';
import type { ReactionSummary } from '../features/flipbooks';

const REACTIONS: ReactionSummary = {
  counts: { like: 1, love: 0, haha: 0, wow: 0, sad: 0, angry: 0 },
  total: 1,
  viewerReaction: null,
  reactors: [{ username: 'maria', type: 'like' }],
};

const PHOTO = {
  _id: 'p1',
  url: '/photo1.jpg',
  filename: 'photo1.jpg',
  reactions: REACTIONS,
  commentCount: 0,
};

const renderLightbox = (props: Partial<ComponentProps<typeof PhotoLightbox>> = {}) =>
  render(
    <MemoryRouter>
      <PhotoLightbox
        photos={[PHOTO]}
        index={0}
        onClose={vi.fn()}
        onNavigate={vi.fn()}
        onReact={vi.fn()}
        comments={[]}
        onAddComment={vi.fn()}
        onDeleteComment={vi.fn()}
        {...props}
      />
    </MemoryRouter>
  );

describe('PhotoLightbox', () => {
  test('Escape closes the lightbox when no nested overlay is open', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderLightbox({ onClose });

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('Escape closes the reactors modal without also closing the lightbox', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderLightbox({ onClose });

    await user.click(screen.getByRole('button', { name: 'See who reacted (1)' }));
    expect(screen.getByRole('link', { name: 'maria' })).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('link', { name: 'maria' })).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  test('ArrowRight navigates to the next photo', async () => {
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    renderLightbox({
      photos: [PHOTO, { ...PHOTO, _id: 'p2', url: '/photo2.jpg' }],
      onNavigate,
    });

    await user.keyboard('{ArrowRight}');

    expect(onNavigate).toHaveBeenCalledWith(1);
  });

  test('ArrowRight does not navigate while the reactors modal is open on top', async () => {
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    renderLightbox({
      photos: [PHOTO, { ...PHOTO, _id: 'p2', url: '/photo2.jpg' }],
      onNavigate,
    });

    await user.click(screen.getByRole('button', { name: 'See who reacted (1)' }));
    expect(screen.getByRole('link', { name: 'maria' })).toBeInTheDocument();

    // Navigating here would reset ReactionControl's pageId-tracked state and
    // silently close the modal out from under the viewer.
    await user.keyboard('{ArrowRight}');

    expect(onNavigate).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'maria' })).toBeInTheDocument();
  });

  test('Escape closes the comments panel without also closing the lightbox', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderLightbox({ onClose });

    await user.click(screen.getByRole('button', { name: 'View comments (0)' }));
    expect(screen.getByText('No comments yet.')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByText('No comments yet.')).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  test('ArrowRight does not navigate while the comments panel is open on top', async () => {
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    renderLightbox({
      photos: [PHOTO, { ...PHOTO, _id: 'p2', url: '/photo2.jpg' }],
      onNavigate,
    });

    await user.click(screen.getByRole('button', { name: 'View comments (0)' }));
    expect(screen.getByText('No comments yet.')).toBeInTheDocument();

    await user.keyboard('{ArrowRight}');

    expect(onNavigate).not.toHaveBeenCalled();
    expect(screen.getByText('No comments yet.')).toBeInTheDocument();
  });

  test('disables the Previous/Next/Close buttons while the comments panel is open, to protect an in-progress draft', async () => {
    const onNavigate = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderLightbox({
      photos: [PHOTO, { ...PHOTO, _id: 'p2', url: '/photo2.jpg' }],
      onNavigate,
      onClose,
    });

    await user.click(screen.getByRole('button', { name: 'View comments (0)' }));

    expect(screen.getByRole('button', { name: 'Next photo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous photo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Close photo viewer' })).toBeDisabled();

    // The backdrop click handler must also be suppressed, not just the button.
    await user.click(screen.getByRole('dialog', { name: 'Photo viewer' }));
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Collapse comments' }));
    expect(screen.getByRole('button', { name: 'Next photo' })).toBeEnabled();
  });

  test('typing into the comment composer is not intercepted by the reaction picker\'s "r"/digit shortcuts', async () => {
    const onReact = vi.fn();
    const user = userEvent.setup();
    renderLightbox({ onReact });

    await user.click(screen.getByRole('button', { name: 'View comments (0)' }));
    const textarea = screen.getByPlaceholderText('Add a comment…');
    await user.type(textarea, 'really great, 1 of a kind');

    expect(textarea).toHaveValue('really great, 1 of a kind');
    expect(onReact).not.toHaveBeenCalled();
  });

  test('does not render the comment control when comment callbacks are absent (editor view)', () => {
    renderLightbox({ comments: undefined, onAddComment: undefined, onDeleteComment: undefined });

    expect(screen.queryByRole('button', { name: /view comments/i })).not.toBeInTheDocument();
  });

  test('shows the autoplay countdown bar only while autoplay is on', () => {
    const { rerender } = renderLightbox({ isAutoPlaying: false, autoPlayIntervalMs: 5000 });
    expect(document.querySelector('.autoplay-progress-bar')).not.toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <PhotoLightbox
          photos={[PHOTO]}
          index={0}
          onClose={vi.fn()}
          onNavigate={vi.fn()}
          onReact={vi.fn()}
          isAutoPlaying
          autoPlayIntervalMs={5000}
        />
      </MemoryRouter>
    );
    expect(document.querySelector('.autoplay-progress-bar')).toBeInTheDocument();
  });
});
