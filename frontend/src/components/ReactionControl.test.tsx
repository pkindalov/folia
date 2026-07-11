import { describe, test, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReactionControl from './ReactionControl';
import type { ReactionSummary } from '../features/flipbooks';

const NO_REACTIONS: ReactionSummary = {
  counts: { like: 0, love: 0, haha: 0, wow: 0, sad: 0, angry: 0 },
  total: 0,
  viewerReaction: null,
};

describe('ReactionControl', () => {
  test('shows a neutral "React" trigger and no summary when there are no reactions', () => {
    render(
      <ReactionControl pageId="p1" reactions={NO_REACTIONS} onReact={vi.fn()} isPending={false} variant="light" />
    );
    expect(screen.getByRole('button', { name: /react to this photo/i })).toHaveTextContent('React');
    expect(screen.queryByLabelText(/reactions?$/i)).not.toBeInTheDocument();
  });

  test('opens a picker with all six reaction options when the trigger is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ReactionControl pageId="p1" reactions={NO_REACTIONS} onReact={vi.fn()} isPending={false} variant="light" />
    );

    await user.click(screen.getByRole('button', { name: /react to this photo/i }));

    const picker = screen.getByRole('group', { name: /choose a reaction/i });
    for (const label of ['Like', 'Love', 'Haha', 'Wow', 'Sad', 'Angry']) {
      expect(within(picker).getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  test('picking a reaction calls onReact with that type and closes the picker', async () => {
    const onReact = vi.fn();
    const user = userEvent.setup();
    render(
      <ReactionControl pageId="p1" reactions={NO_REACTIONS} onReact={onReact} isPending={false} variant="light" />
    );

    await user.click(screen.getByRole('button', { name: /react to this photo/i }));
    await user.click(screen.getByRole('button', { name: 'Love' }));

    expect(onReact).toHaveBeenCalledWith('love');
    expect(screen.queryByRole('group', { name: /choose a reaction/i })).not.toBeInTheDocument();
  });

  test('re-picking the viewer\'s current reaction calls onReact with the same type (caller handles toggle-off)', async () => {
    const onReact = vi.fn();
    const user = userEvent.setup();
    const reactions: ReactionSummary = {
      counts: { ...NO_REACTIONS.counts, love: 1 },
      total: 1,
      viewerReaction: 'love',
    };
    render(
      <ReactionControl pageId="p1" reactions={reactions} onReact={onReact} isPending={false} variant="light" />
    );

    await user.click(screen.getByRole('button', { name: /you reacted: love/i }));
    await user.click(screen.getByRole('button', { name: 'Love' }));

    expect(onReact).toHaveBeenCalledWith('love');
  });

  test('shows the reaction name on the trigger when the viewer has reacted', () => {
    const reactions: ReactionSummary = {
      counts: { ...NO_REACTIONS.counts, haha: 1 },
      total: 1,
      viewerReaction: 'haha',
    };
    render(
      <ReactionControl pageId="p1" reactions={reactions} onReact={vi.fn()} isPending={false} variant="light" />
    );
    expect(screen.getByRole('button', { name: /you reacted: haha/i })).toHaveTextContent('Haha');
  });

  test('shows the total reaction count when there are reactions', () => {
    const reactions: ReactionSummary = {
      counts: { ...NO_REACTIONS.counts, like: 2, love: 3 },
      total: 5,
      viewerReaction: null,
    };
    render(
      <ReactionControl pageId="p1" reactions={reactions} onReact={vi.fn()} isPending={false} variant="light" />
    );
    expect(screen.getByLabelText('5 reactions')).toBeInTheDocument();
  });

  test('disables the trigger and shows a spinner while a request is in flight', () => {
    render(<ReactionControl pageId="p1" reactions={NO_REACTIONS} onReact={vi.fn()} isPending variant="light" />);
    expect(screen.getByRole('button', { name: /react to this photo/i })).toBeDisabled();
  });

  test('closes the picker on Escape without calling onReact', async () => {
    const onReact = vi.fn();
    const user = userEvent.setup();
    render(
      <ReactionControl pageId="p1" reactions={NO_REACTIONS} onReact={onReact} isPending={false} variant="light" />
    );

    await user.click(screen.getByRole('button', { name: /react to this photo/i }));
    expect(screen.getByRole('group', { name: /choose a reaction/i })).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('group', { name: /choose a reaction/i })).not.toBeInTheDocument();
    expect(onReact).not.toHaveBeenCalled();
  });

  test('closes the picker when the underlying photo changes (e.g. keyboard navigation in the lightbox)', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <ReactionControl pageId="p1" reactions={NO_REACTIONS} onReact={vi.fn()} isPending={false} variant="dark" />
    );

    await user.click(screen.getByRole('button', { name: /react to this photo/i }));
    expect(screen.getByRole('group', { name: /choose a reaction/i })).toBeInTheDocument();

    rerender(
      <ReactionControl pageId="p2" reactions={NO_REACTIONS} onReact={vi.fn()} isPending={false} variant="dark" />
    );

    expect(screen.queryByRole('group', { name: /choose a reaction/i })).not.toBeInTheDocument();
  });

  test('does not close the picker on an unrelated re-render for the same photo', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <ReactionControl pageId="p1" reactions={NO_REACTIONS} onReact={vi.fn()} isPending={false} variant="light" />
    );

    await user.click(screen.getByRole('button', { name: /react to this photo/i }));
    expect(screen.getByRole('group', { name: /choose a reaction/i })).toBeInTheDocument();

    rerender(
      <ReactionControl pageId="p1" reactions={NO_REACTIONS} onReact={vi.fn()} isPending={false} variant="light" />
    );

    expect(screen.getByRole('group', { name: /choose a reaction/i })).toBeInTheDocument();
  });
});
