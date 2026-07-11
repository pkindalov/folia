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

const PHOTO = { _id: 'p1', url: '/photo1.jpg', filename: 'photo1.jpg', reactions: REACTIONS };

const renderLightbox = (props: Partial<ComponentProps<typeof PhotoLightbox>> = {}) =>
  render(
    <MemoryRouter>
      <PhotoLightbox
        photos={[PHOTO]}
        index={0}
        onClose={vi.fn()}
        onNavigate={vi.fn()}
        onReact={vi.fn()}
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
});
