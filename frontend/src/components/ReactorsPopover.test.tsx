import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReactorsPopover from './ReactorsPopover';
import type { Reactor } from '../features/flipbooks';

const REACTORS: Reactor[] = [
  { username: 'maria', type: 'love' },
  { username: 'sam', type: 'like' },
];

describe('ReactorsPopover', () => {
  test('renders the trigger content and no list before it is opened', () => {
    render(
      <ReactorsPopover
        reactors={REACTORS}
        variant="light"
        triggerAriaLabel="See who reacted (2)"
        panelAriaLabel="People who reacted"
      >
        <span>trigger content</span>
      </ReactorsPopover>
    );

    expect(screen.getByText('trigger content')).toBeInTheDocument();
    expect(screen.queryByText('maria')).not.toBeInTheDocument();
  });

  test('opens the list of reactors when the trigger is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ReactorsPopover
        reactors={REACTORS}
        variant="light"
        triggerAriaLabel="See who reacted (2)"
        panelAriaLabel="People who reacted"
      >
        <span>trigger content</span>
      </ReactorsPopover>
    );

    await user.click(screen.getByRole('button', { name: 'See who reacted (2)' }));

    expect(screen.getByText('maria')).toBeInTheDocument();
    expect(screen.getByText('sam')).toBeInTheDocument();
  });

  test('closes on Escape', async () => {
    const user = userEvent.setup();
    render(
      <ReactorsPopover
        reactors={REACTORS}
        variant="light"
        triggerAriaLabel="See who reacted (2)"
        panelAriaLabel="People who reacted"
      >
        <span>trigger content</span>
      </ReactorsPopover>
    );

    await user.click(screen.getByRole('button', { name: 'See who reacted (2)' }));
    expect(screen.getByText('maria')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByText('maria')).not.toBeInTheDocument();
  });

  test('closes when clicking outside the popover', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <ReactorsPopover
          reactors={REACTORS}
          variant="light"
          triggerAriaLabel="See who reacted (2)"
          panelAriaLabel="People who reacted"
        >
          <span>trigger content</span>
        </ReactorsPopover>
        <button type="button">Outside</button>
      </div>
    );

    await user.click(screen.getByRole('button', { name: 'See who reacted (2)' }));
    expect(screen.getByText('maria')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Outside' }));
    expect(screen.queryByText('maria')).not.toBeInTheDocument();
  });

  test('renders each reactor with an icon matching their reaction type', async () => {
    const user = userEvent.setup();
    render(
      <ReactorsPopover
        reactors={REACTORS}
        variant="light"
        triggerAriaLabel="See who reacted (2)"
        panelAriaLabel="People who reacted"
      >
        <span>trigger content</span>
      </ReactorsPopover>
    );

    await user.click(screen.getByRole('button', { name: 'See who reacted (2)' }));

    expect(screen.getByText('favorite')).toBeInTheDocument();
    expect(screen.getByText('thumb_up')).toBeInTheDocument();
  });

  test('gives the opened list its own accessible name, distinct from the trigger', async () => {
    const user = userEvent.setup();
    render(
      <ReactorsPopover
        reactors={REACTORS}
        variant="light"
        triggerAriaLabel="See who reacted (2)"
        panelAriaLabel="People who reacted"
      >
        <span>trigger content</span>
      </ReactorsPopover>
    );

    await user.click(screen.getByRole('button', { name: 'See who reacted (2)' }));

    expect(screen.getByRole('group', { name: 'People who reacted' })).toBeInTheDocument();
  });

  test('shows an optional tooltip on the trigger', () => {
    render(
      <ReactorsPopover
        reactors={REACTORS}
        variant="light"
        triggerAriaLabel="See who reacted (2)"
        panelAriaLabel="People who reacted"
        triggerTitle="Love: 1 · Like: 1"
      >
        <span>trigger content</span>
      </ReactorsPopover>
    );

    expect(screen.getByRole('button', { name: 'See who reacted (2)' })).toHaveAttribute(
      'title',
      'Love: 1 · Like: 1'
    );
  });

  test('closes via a keyboard-reachable Close button, not just Escape or a mouse click', async () => {
    const user = userEvent.setup();
    render(
      <ReactorsPopover
        reactors={REACTORS}
        variant="light"
        triggerAriaLabel="See who reacted (2)"
        panelAriaLabel="People who reacted"
      >
        <span>trigger content</span>
      </ReactorsPopover>
    );

    await user.click(screen.getByRole('button', { name: 'See who reacted (2)' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByText('maria')).not.toBeInTheDocument();
  });

  test('Tab moves focus onto the Close button instead of being trapped with nowhere to go', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <ReactorsPopover
          reactors={REACTORS}
          variant="light"
          triggerAriaLabel="See who reacted (2)"
          panelAriaLabel="People who reacted"
        >
          <span>trigger content</span>
        </ReactorsPopover>
      </div>
    );

    await user.click(screen.getByRole('button', { name: 'See who reacted (2)' }));
    await user.tab();

    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
  });
});
