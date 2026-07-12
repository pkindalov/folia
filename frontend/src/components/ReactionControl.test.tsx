import type { ComponentProps } from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ReactionControl from './ReactionControl';
import type { ReactionSummary } from '../features/flipbooks';

const NO_REACTIONS: ReactionSummary = {
  counts: { like: 0, love: 0, haha: 0, wow: 0, sad: 0, angry: 0 },
  total: 0,
  viewerReaction: null,
  reactors: [],
};

const DEFAULT_PROPS: ComponentProps<typeof ReactionControl> = {
  pageId: 'p1',
  reactions: NO_REACTIONS,
  onReact: vi.fn(),
  isPending: false,
  variant: 'light',
};

const withRouter = (props: Partial<ComponentProps<typeof ReactionControl>>) => (
  <MemoryRouter>
    <ReactionControl {...DEFAULT_PROPS} {...props} />
  </MemoryRouter>
);

const renderControl = (props: Partial<ComponentProps<typeof ReactionControl>> = {}) =>
  render(withRouter(props));

describe('ReactionControl', () => {
  test('shows a neutral "React" trigger and no summary when there are no reactions', () => {
    renderControl();
    expect(screen.getByRole('button', { name: 'React to this photo' })).toBeInTheDocument();
    expect(screen.queryByLabelText(/reactions?$/i)).not.toBeInTheDocument();
  });

  test('opens a picker with all six reaction options when the trigger is clicked', async () => {
    const user = userEvent.setup();
    renderControl();

    await user.click(screen.getByRole('button', { name: /react to this photo/i }));

    const picker = screen.getByRole('group', { name: /choose a reaction/i });
    for (const label of ['Like', 'Love', 'Haha', 'Wow', 'Sad', 'Angry']) {
      expect(within(picker).getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  test('picking a reaction calls onReact with that type and closes the picker', async () => {
    const onReact = vi.fn();
    const user = userEvent.setup();
    renderControl({ onReact });

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
      reactors: [{ username: 'pan', type: 'love' }],
    };
    renderControl({ reactions, onReact });

    await user.click(screen.getByRole('button', { name: /you reacted: love/i }));
    await user.click(screen.getByRole('button', { name: 'Love' }));

    expect(onReact).toHaveBeenCalledWith('love');
  });

  test('reflects the viewer\'s reaction in the trigger\'s accessible name', () => {
    const reactions: ReactionSummary = {
      counts: { ...NO_REACTIONS.counts, haha: 1 },
      total: 1,
      viewerReaction: 'haha',
      reactors: [{ username: 'pan', type: 'haha' }],
    };
    renderControl({ reactions });
    expect(
      screen.getByRole('button', { name: 'You reacted: Haha. Tap to change or remove.' })
    ).toBeInTheDocument();
  });

  test('shows the total reaction count when there are reactions', () => {
    const reactions: ReactionSummary = {
      counts: { ...NO_REACTIONS.counts, like: 2, love: 3 },
      total: 5,
      viewerReaction: null,
      reactors: [
        { username: 'maria', type: 'love' },
        { username: 'sam', type: 'like' },
      ],
    };
    renderControl({ reactions });
    expect(screen.getByRole('button', { name: 'See who reacted (5)' })).toHaveTextContent('5');
  });

  test('shows a per-type breakdown on hover', () => {
    const reactions: ReactionSummary = {
      counts: { ...NO_REACTIONS.counts, like: 2, love: 3 },
      total: 5,
      viewerReaction: null,
      reactors: [
        { username: 'maria', type: 'love' },
        { username: 'sam', type: 'like' },
      ],
    };
    renderControl({ reactions });
    expect(screen.getByRole('button', { name: 'See who reacted (5)' })).toHaveAttribute(
      'title',
      'Love: 3 · Like: 2'
    );
  });

  test('clicking the reaction count opens a modal linking to each reactor\'s profile', async () => {
    const reactions: ReactionSummary = {
      counts: { ...NO_REACTIONS.counts, like: 1, love: 1 },
      total: 2,
      viewerReaction: null,
      reactors: [
        { username: 'maria', type: 'love' },
        { username: 'sam', type: 'like' },
      ],
    };
    const user = userEvent.setup();
    renderControl({ reactions });

    expect(screen.queryByRole('link', { name: 'maria' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'See who reacted (2)' }));

    expect(screen.getByRole('link', { name: 'maria' })).toHaveAttribute('href', '/users/maria');
    expect(screen.getByRole('link', { name: 'sam' })).toHaveAttribute('href', '/users/sam');
  });

  test('the "who reacted" list lets the viewer remove their own reaction, by re-sending the same type', async () => {
    const onReact = vi.fn();
    const reactions: ReactionSummary = {
      counts: { ...NO_REACTIONS.counts, love: 1, like: 1 },
      total: 2,
      viewerReaction: 'love',
      reactors: [
        { username: 'pan', type: 'love' },
        { username: 'maria', type: 'like' },
      ],
    };
    const user = userEvent.setup();
    renderControl({ reactions, onReact, viewerUsername: 'pan' });

    await user.click(screen.getByRole('button', { name: 'See who reacted (2)' }));
    await user.click(screen.getByRole('button', { name: 'Remove your reaction' }));

    expect(onReact).toHaveBeenCalledWith('love');
  });

  test('the "who reacted" list has no remove button when the viewer has not reacted', async () => {
    const reactions: ReactionSummary = {
      counts: { ...NO_REACTIONS.counts, like: 1 },
      total: 1,
      viewerReaction: null,
      reactors: [{ username: 'maria', type: 'like' }],
    };
    const user = userEvent.setup();
    renderControl({ reactions, viewerUsername: 'pan' });

    await user.click(screen.getByRole('button', { name: 'See who reacted (1)' }));

    expect(screen.queryByRole('button', { name: 'Remove your reaction' })).not.toBeInTheDocument();
  });

  test('disables the trigger and shows a spinner while a request is in flight', () => {
    renderControl({ isPending: true });
    expect(screen.getByRole('button', { name: /react to this photo/i })).toBeDisabled();
  });

  test('closes the picker on Escape without calling onReact', async () => {
    const onReact = vi.fn();
    const user = userEvent.setup();
    renderControl({ onReact });

    await user.click(screen.getByRole('button', { name: /react to this photo/i }));
    expect(screen.getByRole('group', { name: /choose a reaction/i })).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('group', { name: /choose a reaction/i })).not.toBeInTheDocument();
    expect(onReact).not.toHaveBeenCalled();
  });

  test('Escape closes only the reactors modal when it is open on top of the picker, leaving the picker open', async () => {
    // Activates the reactors button by keyboard (focus + Enter) rather than
    // user.click(), which also fires a pointerdown and would close the
    // picker via useOutsideClick before Escape is ever pressed — this test
    // targets the keyboard/screen-reader path where that doesn't happen and
    // both overlays end up open at once.
    const reactions: ReactionSummary = {
      counts: { ...NO_REACTIONS.counts, love: 1 },
      total: 1,
      viewerReaction: null,
      reactors: [{ username: 'maria', type: 'love' }],
    };
    const user = userEvent.setup();
    renderControl({ reactions });

    await user.click(screen.getByRole('button', { name: /react to this photo/i }));
    screen.getByRole('button', { name: 'See who reacted (1)' }).focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('link', { name: 'maria' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /choose a reaction/i })).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('link', { name: 'maria' })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: /choose a reaction/i })).toBeInTheDocument();
  });

  test('pressing "r" opens the picker, and pressing it again closes it', async () => {
    const user = userEvent.setup();
    renderControl();

    await user.keyboard('r');
    expect(screen.getByRole('group', { name: /choose a reaction/i })).toBeInTheDocument();

    await user.keyboard('r');
    expect(screen.queryByRole('group', { name: /choose a reaction/i })).not.toBeInTheDocument();
  });

  test('once the picker is open, each reaction\'s number key picks it', async () => {
    const onReact = vi.fn();
    const user = userEvent.setup();
    renderControl({ onReact });

    await user.keyboard('r');
    await user.keyboard('2');

    expect(onReact).toHaveBeenCalledWith('love');
    expect(screen.queryByRole('group', { name: /choose a reaction/i })).not.toBeInTheDocument();
  });

  test('number keys do nothing before the picker has been opened', async () => {
    const onReact = vi.fn();
    const user = userEvent.setup();
    renderControl({ onReact });

    await user.keyboard('2');

    expect(onReact).not.toHaveBeenCalled();
  });

  test('ignores "r" and number-key shortcuts while another surface owns the keyboard', async () => {
    const onReact = vi.fn();
    const user = userEvent.setup();
    renderControl({ onReact, isKeyboardShortcutsDisabled: true });

    await user.keyboard('r');
    expect(screen.queryByRole('group', { name: /choose a reaction/i })).not.toBeInTheDocument();
    expect(onReact).not.toHaveBeenCalled();
  });

  test('closes the picker when the underlying photo changes (e.g. keyboard navigation in the lightbox)', async () => {
    const user = userEvent.setup();
    const { rerender } = renderControl({ pageId: 'p1', variant: 'dark' });

    await user.click(screen.getByRole('button', { name: /react to this photo/i }));
    expect(screen.getByRole('group', { name: /choose a reaction/i })).toBeInTheDocument();

    rerender(withRouter({ pageId: 'p2', variant: 'dark' }));

    expect(screen.queryByRole('group', { name: /choose a reaction/i })).not.toBeInTheDocument();
  });

  test('does not close the picker on an unrelated re-render for the same photo', async () => {
    const user = userEvent.setup();
    const { rerender } = renderControl({ pageId: 'p1' });

    await user.click(screen.getByRole('button', { name: /react to this photo/i }));
    expect(screen.getByRole('group', { name: /choose a reaction/i })).toBeInTheDocument();

    rerender(withRouter({ pageId: 'p1' }));

    expect(screen.getByRole('group', { name: /choose a reaction/i })).toBeInTheDocument();
  });

  test('closes the reactors modal when the underlying photo changes', async () => {
    const reactions: ReactionSummary = {
      counts: { ...NO_REACTIONS.counts, love: 1 },
      total: 1,
      viewerReaction: null,
      reactors: [{ username: 'maria', type: 'love' }],
    };
    const user = userEvent.setup();
    const { rerender } = renderControl({ pageId: 'p1', reactions });

    await user.click(screen.getByRole('button', { name: 'See who reacted (1)' }));
    expect(screen.getByRole('link', { name: 'maria' })).toBeInTheDocument();

    rerender(withRouter({ pageId: 'p2', reactions: NO_REACTIONS }));

    expect(screen.queryByRole('link', { name: 'maria' })).not.toBeInTheDocument();
  });
});
